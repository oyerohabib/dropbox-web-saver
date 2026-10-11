import { defineBackground } from "wxt/utils/define-background";
import { BADGE_RESET_DELAY_MS } from "../lib/constants";
import {
  describeAssetTargetInTab,
  ensureContentScript,
  fetchAssetBytesFromTab,
  getActiveTab,
  RestrictedPageError,
  sendMessageToTab,
} from "../lib/browser";
import { connectDropbox, disconnectDropbox, getAuthState } from "../lib/dropbox-auth";
import { getCurrentAccount, listFolders } from "../lib/dropbox-api";
import {
  createFolderAndSelect,
  createPendingSave,
  createPendingScanState,
  saveAsset,
} from "../lib/save-orchestrator";
import {
  getPendingSave,
  getRecentSaves,
  getSaveWindowId,
  getSettings,
  setLastResult,
  setPendingSave,
  setSaveWindowId,
  setTokens,
  updateSettings,
} from "../lib/storage";
import type {
  AssetCandidate,
  AssetFetchPayload,
  AssetTriggerKind,
  BackgroundMessage,
  ExtensionSettings,
  SaveRequest,
  SaveResult,
  ScanPageAssetsResponse,
  StartScanFlowResponse,
} from "../lib/types";
import { applyProbeResult, probeAssetMetadata } from "../lib/asset-probe";
import { detectAssetType } from "../lib/utils/asset";
import { deriveCandidateFilename, hasExtension } from "../lib/utils/filename";
import { isLikelyDirectAssetUrl } from "../lib/utils/url";

const MENU_IDS = {
  image: "save-image-to-dropbox",
  video: "save-video-to-dropbox",
  audio: "save-audio-to-dropbox",
  link: "save-link-to-dropbox",
  scan: "scan-page-assets-for-dropbox",
} as const;

function getTriggerKind(menuItemId?: string): AssetTriggerKind | null {
  switch (menuItemId) {
    case MENU_IDS.image:
      return "image";
    case MENU_IDS.video:
      return "video";
    case MENU_IDS.audio:
      return "audio";
    case MENU_IDS.link:
      return "linked_file";
    default:
      return null;
  }
}

function buildCandidateFromContext(
  info: chrome.contextMenus.OnClickData,
  triggerKind: AssetTriggerKind,
): AssetCandidate | null {
  const sourceUrl = info.srcUrl || info.linkUrl;
  if (!sourceUrl) return null;

  const pageUrl = info.pageUrl || sourceUrl;
  const sourceOrigin = (() => {
    try {
      return new URL(sourceUrl).origin;
    } catch {
      return "";
    }
  })();
  const pageOrigin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return "";
    }
  })();
  const detectedType =
    triggerKind === "image"
      ? "image"
      : triggerKind === "video"
        ? "video"
        : triggerKind === "audio"
          ? "audio"
          : detectAssetType(sourceUrl);

  return {
    sourceUrl,
    pageUrl,
    detectedType,
    suggestedFilename: null,
    requiresAuthenticatedFetch:
      sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:") || sourceOrigin === pageOrigin,
    referrer: pageUrl,
    triggerKind,
  };
}

async function openSaveWindow() {
  const existingWindowId = await getSaveWindowId();
  if (existingWindowId !== null) {
    // Untrack before closing so onRemoved does not treat this as the user cancelling the new flow.
    await setSaveWindowId(null);
    await chrome.windows.remove(existingWindowId).catch(() => undefined);
  }

  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("save.html"),
    type: "popup",
    width: 560,
    height: 820,
  });
  await setSaveWindowId(created?.id ?? null);
}

async function openFolderSettingsWindow() {
  await setPendingSave(null);
  await openSaveWindow();
}

async function setBadgeForResult(result: SaveResult) {
  await chrome.action.setBadgeBackgroundColor({
    color: result.ok ? "#0b7a55" : "#ad2d2d",
  });
  await chrome.action.setBadgeText({
    text: result.ok ? "OK" : "ERR",
  });

  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
  }, BADGE_RESET_DELAY_MS);
}

async function reportUnsupportedTarget(message: string): Promise<SaveResult> {
  const result: SaveResult = {
    ok: false,
    status: "unsupported",
    errorCode: "UNSUPPORTED_TARGET",
    message,
  };
  await setLastResult(result);
  await setBadgeForResult(result);
  return result;
}

async function fetchAssetBytesInBackground(
  candidate: AssetCandidate,
  includeCredentials: boolean,
): Promise<AssetFetchPayload> {
  try {
    const response = await fetch(candidate.sourceUrl, {
      credentials: includeCredentials ? "include" : "omit",
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        contentDisposition: response.headers.get("content-disposition"),
        error: `Source fetch failed (${response.status})`,
      };
    }
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      finalUrl: response.url,
      contentDisposition: response.headers.get("content-disposition"),
      arrayBuffer: await response.arrayBuffer(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      error: error instanceof Error ? error.message : "Could not fetch the source asset.",
    };
  }
}

async function fetchAssetBytes(candidate: AssetCandidate, tabId?: number): Promise<AssetFetchPayload> {
  if (!candidate.requiresAuthenticatedFetch || !tabId) {
    return fetchAssetBytesInBackground(candidate, candidate.requiresAuthenticatedFetch);
  }

  let tabError: string | undefined;
  try {
    const payload = await fetchAssetBytesFromTab(tabId, candidate.sourceUrl, candidate.referrer);
    if (payload.ok) return payload;
    tabError = payload.error;
  } catch (error) {
    tabError = error instanceof Error ? error.message : undefined;
  }

  // blob: URLs only exist inside the page, so there is nothing to fall back to.
  if (candidate.sourceUrl.startsWith("blob:")) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      error: tabError || "Could not read this asset from the page.",
    };
  }

  const fallback = await fetchAssetBytesInBackground(candidate, true);
  return fallback.ok ? fallback : { ...fallback, error: tabError || fallback.error };
}

async function executeSaveRequest(
  request: SaveRequest,
  options: { fromSaveWindow?: boolean } = {},
) {
  const result = await saveAsset(request, { fetchAssetBytes, probeAssetMetadata });
  // Saves started from the save window keep its existing pending flow; reopening would close that window.
  if (!options.fromSaveWindow && (result.status === "needs_auth" || result.status === "needs_folder")) {
    await setPendingSave(
      createPendingSave(request, result.status === "needs_auth" ? "auth_required" : "folder_required"),
    );
    await openSaveWindow();
  }
  await setBadgeForResult(result);
  return result;
}

async function queueSaveFlow(
  request: SaveRequest,
  settings: ExtensionSettings,
  options?: { forceReview?: boolean; reason?: "manual_override" | "context_review" },
) {
  const { savePreferences } = settings;
  const needsFolderSelection =
    request.forceFolderPicker
    || savePreferences.folderBehavior === "always_ask"
    || !request.destinationPath;
  const needsReview =
    options?.forceReview
    || savePreferences.saveMode === "reviewed"
    || savePreferences.promptForRename
    || needsFolderSelection;

  if (needsReview) {
    await setPendingSave(
      createPendingSave(
        {
          ...request,
          forceFolderPicker: needsFolderSelection,
        },
        options?.reason || "context_review",
      ),
    );
    await openSaveWindow();
    return;
  }

  await executeSaveRequest(request);
}

async function scanTab(tabId: number): Promise<AssetCandidate[]> {
  await ensureContentScript(tabId);
  const response = await sendMessageToTab<ScanPageAssetsResponse>(tabId, { type: "SCAN_PAGE_ASSETS" });
  return response?.assets ?? [];
}

async function scanActiveTab(): Promise<AssetCandidate[]> {
  const tab = await getActiveTab();
  if (!tab?.id) return [];
  try {
    return await scanTab(tab.id);
  } catch {
    return [];
  }
}

async function describeCandidate(candidate: AssetCandidate, tabId?: number): Promise<AssetCandidate> {
  if (!tabId) return candidate;
  try {
    const description = await describeAssetTargetInTab(tabId, candidate.sourceUrl);
    return {
      ...candidate,
      detectedType:
        candidate.detectedType === "unknown" && description.hasDownloadAttribute
          ? "link"
          : candidate.detectedType,
      preferredFilename: description.preferredFilename ?? candidate.preferredFilename,
      elementTextHint: description.elementTextHint ?? candidate.elementTextHint,
      mimeType: description.mimeType ?? candidate.mimeType,
    };
  } catch {
    return candidate;
  }
}

async function enrichCandidate(candidate: AssetCandidate, tabId?: number): Promise<AssetCandidate> {
  const described = await describeCandidate(candidate, tabId);
  if (hasExtension(deriveCandidateFilename(described))) return described;
  return applyProbeResult(described, await probeAssetMetadata(described));
}

async function startScanFlow(): Promise<StartScanFlowResponse> {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    return { ok: false, message: "Open a regular website tab, then try scanning again." };
  }

  let assets: AssetCandidate[];
  try {
    assets = await scanTab(activeTab.id);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof RestrictedPageError
          ? error.message
          : "Could not scan this page. Reload the tab and try again.",
    };
  }
  if (assets.length === 0) {
    return {
      ok: false,
      message: "No supported images, videos, audio files, or linked files were found on this page.",
    };
  }

  const settings = await getSettings();
  const flow = createPendingScanState(
    assets,
    activeTab.id,
    settings.savePreferences.folderBehavior === "always_ask"
      ? null
      : settings.lastUsedFolderPath,
  );
  await setPendingSave(flow);
  await openSaveWindow();
  return { ok: true, flow };
}

async function initializeContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_IDS.image,
    title: "Save image to Dropbox",
    contexts: ["image"],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.video,
    title: "Save video to Dropbox",
    contexts: ["video"],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.audio,
    title: "Save audio to Dropbox",
    contexts: ["audio"],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.link,
    title: "Save linked file to Dropbox",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.scan,
    title: "Scan page assets for Dropbox",
    contexts: ["page", "selection"],
  });
}

export default defineBackground(() => {
  void initializeContextMenus();

  chrome.runtime.onInstalled.addListener(() => {
    void initializeContextMenus();
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    void (async () => {
      if ((await getSaveWindowId()) !== windowId) return;
      await setSaveWindowId(null);
      await setPendingSave(null);
    })();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      if (info.menuItemId === MENU_IDS.scan) {
        const response = await startScanFlow();
        if (!response.ok) {
          await reportUnsupportedTarget(response.message);
        }
        return;
      }

      const triggerKind = getTriggerKind(String(info.menuItemId));
      if (!triggerKind) return;

      const candidate = buildCandidateFromContext(info, triggerKind);
      if (!candidate) return;
      let enrichedCandidate = await enrichCandidate(candidate, tab?.id);

      if (triggerKind === "linked_file" && enrichedCandidate.detectedType === "unknown") {
        const servesFile =
          Boolean(enrichedCandidate.contentDispositionFilename)
          || Boolean(enrichedCandidate.mimeType && !/^text\/html|^application\/xhtml/.test(enrichedCandidate.mimeType));
        if (
          !servesFile &&
          !isLikelyDirectAssetUrl(enrichedCandidate.sourceUrl) &&
          !enrichedCandidate.preferredFilename
        ) {
          await reportUnsupportedTarget(
            "This link does not appear to point to a downloadable file or media asset.",
          );
          return;
        }
        enrichedCandidate = { ...enrichedCandidate, detectedType: "link" };
      }

      const settings = await getSettings();
      await queueSaveFlow({
        candidate: enrichedCandidate,
        destinationPath:
          settings.savePreferences.folderBehavior === "always_ask"
            ? null
            : settings.lastUsedFolderPath,
        tabId: tab?.id,
      }, settings, { reason: "context_review" });
    })();
  });

  chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
    void (async () => {
      switch (message.type) {
        case "GET_AUTH_STATE":
          sendResponse(await getAuthState());
          return;
        case "CONNECT_DROPBOX":
          await connectDropbox();
          await getCurrentAccount().catch(() => undefined);
          sendResponse(await getAuthState());
          return;
        case "DISCONNECT_DROPBOX":
          await disconnectDropbox();
          sendResponse({ ok: true });
          return;
        case "GET_SETTINGS":
          sendResponse(await getSettings());
          return;
        case "SAVE_SETTINGS": {
          const currentSettings = await getSettings();
          if (
            Object.prototype.hasOwnProperty.call(message.settings, "appKey")
            && currentSettings.appKey !== message.settings.appKey
          ) {
            await setTokens(null);
          }
          sendResponse(await updateSettings(message.settings));
          return;
        }
        case "LIST_FOLDERS":
          sendResponse(await listFolders(message.path));
          return;
        case "SET_LAST_USED_FOLDER":
          sendResponse(await updateSettings({ lastUsedFolderPath: message.path }));
          return;
        case "CREATE_FOLDER":
          sendResponse(await createFolderAndSelect(message.parentPath, message.name));
          return;
        case "GET_PENDING_SAVE":
          sendResponse(await getPendingSave());
          return;
        case "CLEAR_PENDING_SAVE":
          await setPendingSave(null);
          sendResponse({ ok: true });
          return;
        case "SAVE_PENDING": {
          const pending = await getPendingSave();
          if (!pending) {
            sendResponse({
              ok: false,
              status: "failed",
              message: "No pending save request was found.",
            } satisfies SaveResult);
            return;
          }

          if (pending.mode === "scan") {
            const selectedCandidate = message.candidate
              ?? pending.assets.find((asset) => asset.sourceUrl === pending.selectedSourceUrl)
              ?? pending.assets[0];
            if (!selectedCandidate) {
              sendResponse({
                ok: false,
                status: "unsupported",
                errorCode: "UNSUPPORTED_TARGET",
                message: "No supported asset was selected.",
              } satisfies SaveResult);
              return;
            }
            sendResponse(
              await executeSaveRequest({
                candidate: selectedCandidate,
                destinationPath: message.destinationPath,
                tabId: pending.tabId,
                finalFilename: message.finalFilename ?? pending.selectedFilename,
              }, { fromSaveWindow: true }),
            );
            return;
          }

          sendResponse(
            await executeSaveRequest({
              ...pending.request,
              destinationPath: message.destinationPath,
              finalFilename: message.finalFilename ?? pending.request.finalFilename,
            }, { fromSaveWindow: true }),
          );
          return;
        }
        case "SAVE_CANDIDATE":
          sendResponse(
            await executeSaveRequest({
              ...message.request,
              tabId: message.request.tabId ?? (await getActiveTab())?.id,
            }),
          );
          return;
        case "GET_RECENT_SAVES":
          sendResponse(await getRecentSaves());
          return;
        case "SCAN_ACTIVE_TAB_ASSETS":
          sendResponse(await scanActiveTab());
          return;
        case "START_SCAN_FLOW":
          sendResponse(await startScanFlow());
          return;
      }
    })().catch((error) => {
      sendResponse({
        ok: false,
        status: "failed",
        message: error instanceof Error ? error.message : "Unexpected background error.",
      } satisfies SaveResult);
    });

    return true;
  });
});
