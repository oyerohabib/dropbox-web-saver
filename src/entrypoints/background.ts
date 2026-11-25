import { defineBackground } from "wxt/utils/define-background";
import { BADGE_RESET_DELAY_MS } from "../lib/constants";
import {
  describeAssetTargetInTab,
  ensureContentScript,
  fetchAssetBytesFromTab,
  getActiveTab,
  openPreferencesTab,
  resolveMediaUrlFromTab,
  RestrictedPageError,
  sendMessageToTab,
} from "../lib/browser";
import { connectDropbox, disconnectDropbox, getAuthState } from "../lib/dropbox-auth";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveAuthState,
} from "../lib/google-drive-auth";
import { UNINSTALL_FEEDBACK_URL } from "../lib/project";
import { getCurrentAccount } from "../lib/dropbox-api";
import { getStorageProvider, listStorageProviders } from "../lib/providers";
import {
  createFolderAndSelect,
  createPendingSave,
  createPendingScanState,
  saveAsset,
} from "../lib/save-orchestrator";
import {
  clearRecentSaves,
  getPendingSave,
  getRecentSaves,
  getSaveWindowId,
  getSettings,
  setLastResult,
  setLastUsedFolder,
  setPendingSave,
  setSaveWindowId,
  setTokens,
  updateSettings,
} from "../lib/storage";
import type {
  AssetCandidate,
  AssetFetchPayload,
  AssetTriggerKind,
  BackgroundErrorResponse,
  BackgroundMessage,
  CombinedAuthState,
  ExtensionSettings,
  SaveRequest,
  SaveResult,
  SaveToastStatus,
  ScanPageAssetsResponse,
  StartScanFlowResponse,
  StorageProviderId,
} from "../lib/types";
import { applyProbeResult, probeAssetMetadata } from "../lib/asset-probe";
import { detectAssetType } from "../lib/utils/asset";
import {
  MENU_IDS,
  parentMenuTitle,
  parseProviderMenuId,
  providerMenuId,
} from "../lib/utils/context-menu";
import { deriveCandidateFilename, hasExtension } from "../lib/utils/filename";
import { markUserSaveModeChoice, shouldAutoSwitchToInstant } from "../lib/utils/save-mode";
import { isStreamedMediaUrl } from "../lib/utils/media-url";
import { getOriginPattern, isLikelyDirectAssetUrl } from "../lib/utils/url";

async function getCombinedAuthState(): Promise<CombinedAuthState> {
  const [dropbox, googleDrive] = await Promise.all([
    getAuthState(),
    getGoogleDriveAuthState(),
  ]);
  return { dropbox, googleDrive };
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

let badgeResetTimer: ReturnType<typeof setTimeout> | undefined;

async function setBadge(text: string, color: string, resetAfterMs?: number) {
  clearTimeout(badgeResetTimer);
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  if (resetAfterMs) {
    badgeResetTimer = setTimeout(() => {
      void chrome.action.setBadgeText({ text: "" });
    }, resetAfterMs);
  }
}

async function setBadgeForResult(result: SaveResult) {
  await setBadge(result.ok ? "OK" : "ERR", result.ok ? "#1E8E3E" : "#D93025", BADGE_RESET_DELAY_MS);
}

async function showSaveStatusInTab(tabId: number | undefined, status: SaveToastStatus) {
  if (tabId === undefined) return;
  try {
    await ensureContentScript(tabId);
    await sendMessageToTab(tabId, { type: "SHOW_SAVE_STATUS", status });
  } catch {
    // Restricted pages cannot show toasts; the toolbar badge still reports the result.
  }
}

function toastForResult(result: SaveResult, request: SaveRequest): SaveToastStatus {
  const providerId = request.provider ?? result.provider ?? "dropbox";
  const provider = getStorageProvider(providerId);
  const folderPath = request.destinationPath || provider.getRootFolderKey();
  const providerName = provider.displayName;
  if (result.ok) {
    return {
      state: "success",
      filename: result.filename,
      folderPath: result.folderLabel || provider.formatFolderLabel(folderPath),
      dropboxUrl: providerId === "dropbox" ? provider.getWebUrl(folderPath) : undefined,
      openUrl: provider.getWebUrl(folderPath),
      message: `Saved to ${providerName}`,
    };
  }
  if (result.status === "needs_auth" || result.status === "needs_folder" || result.status === "needs_permission") {
    return { state: "hidden" };
  }
  return { state: "error", filename: result.filename, folderPath, message: result.message };
}

async function reportUnsupportedTarget(message: string, tabId?: number): Promise<SaveResult> {
  const result: SaveResult = {
    ok: false,
    status: "unsupported",
    errorCode: "UNSUPPORTED_TARGET",
    message,
  };
  await setLastResult(result);
  await setBadgeForResult(result);
  await showSaveStatusInTab(tabId, { state: "error", message });
  return result;
}

function pageFetchHeaders(candidate: AssetCandidate): HeadersInit | undefined {
  const pageUrl = candidate.referrer || candidate.pageUrl;
  if (!pageUrl || !/^https?:/i.test(pageUrl)) return undefined;
  try {
    const origin = new URL(pageUrl).origin;
    return {
      Referer: `${origin}/`,
    };
  } catch {
    return undefined;
  }
}

async function fetchAssetBytesInBackground(
  candidate: AssetCandidate,
  includeCredentials: boolean,
): Promise<AssetFetchPayload> {
  try {
    const response = await fetch(candidate.sourceUrl, {
      credentials: includeCredentials ? "include" : "omit",
      referrer: candidate.referrer || candidate.pageUrl || undefined,
      referrerPolicy: "unsafe-url",
      headers: pageFetchHeaders(candidate),
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
  let current = candidate;
  if (tabId) {
    try {
      const resolvedUrl = await resolveMediaUrlFromTab(tabId, candidate.sourceUrl);
      if (resolvedUrl && resolvedUrl !== candidate.sourceUrl) {
        current = { ...candidate, sourceUrl: resolvedUrl };
      }
    } catch {
      // Keep the original URL if the page cannot offer a better file.
    }

    let tabError: string | undefined;
    try {
      const payload = await fetchAssetBytesFromTab(tabId, current.sourceUrl, current.referrer);
      if (payload.ok) return payload;
      tabError = payload.error;
    } catch (error) {
      tabError = error instanceof Error ? error.message : undefined;
    }

    if (isStreamedMediaUrl(current.sourceUrl) && current.sourceUrl.startsWith("blob:")) {
      return {
        ok: false,
        status: 0,
        contentType: null,
        error: "Couldn't find this video's file on the page. Reload the page and try again.",
      };
    }

    const fallback = await fetchAssetBytesInBackground(current, current.requiresAuthenticatedFetch);
    if (fallback.ok) return fallback;
    return {
      ...fallback,
      finalUrl: fallback.finalUrl || current.sourceUrl,
      error: tabError || fallback.error,
    };
  }

  return fetchAssetBytesInBackground(current, current.requiresAuthenticatedFetch);
}

async function findMissingSitePermission(url: string): Promise<string | null> {
  const origin = getOriginPattern(url);
  if (!origin) return null;
  return (await chrome.permissions.contains({ origins: [origin] })) ? null : origin;
}

async function executeSaveRequest(
  request: SaveRequest,
  options: { fromSaveWindow?: boolean } = {},
) {
  const providerId = request.provider ?? "dropbox";
  const provider = getStorageProvider(providerId);
  const authState = await provider.getAuthState();
  const willUpload = Boolean(request.destinationPath) && authState.status === "signed_in";
  if (willUpload) {
    const folderKey = request.destinationPath ?? provider.getRootFolderKey();
    const folderPath = await provider.resolveFolderLabel(folderKey).catch(() => provider.formatFolderLabel(folderKey));
    await setBadge("…", "#0061FE");
    await showSaveStatusInTab(request.tabId, {
      state: "saving",
      filename: deriveCandidateFilename(request.candidate, request.finalFilename),
      folderPath,
      message: `Saving to ${provider.displayName}…`,
    });
  }

  const result = await saveAsset(request, { fetchAssetBytes, probeAssetMetadata, findMissingSitePermission });
  if (willUpload) {
    await showSaveStatusInTab(request.tabId, toastForResult(result, request));
  }
  // Saves started from the save window keep its existing pending flow; reopening would close that window.
  if (
    !options.fromSaveWindow
    && (result.status === "needs_auth" || result.status === "needs_folder" || result.status === "needs_permission")
  ) {
    const reason =
      result.status === "needs_auth"
        ? "auth_required"
        : result.status === "needs_folder"
          ? "folder_required"
          : "permission_required";
    await setPendingSave(createPendingSave(request, reason, result.permissionOrigin));
    await openSaveWindow();
  }
  await setBadgeForResult(result);
  return result;
}

async function saveFromReviewWindow(request: SaveRequest): Promise<SaveResult> {
  const result = await executeSaveRequest(request, { fromSaveWindow: true });
  if (!shouldAutoSwitchToInstant(await getSettings(), result)) return result;
  await updateSettings({ savePreferences: { saveMode: "one_click" } });
  return { ...result, switchedToInstant: true };
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
  let next = described;
  if (tabId && isStreamedMediaUrl(next.sourceUrl)) {
    try {
      const resolvedUrl = await resolveMediaUrlFromTab(tabId, next.sourceUrl);
      if (resolvedUrl && resolvedUrl !== next.sourceUrl) {
        next = {
          ...next,
          sourceUrl: resolvedUrl,
          requiresAuthenticatedFetch:
            resolvedUrl.startsWith("blob:") || resolvedUrl.startsWith("data:"),
        };
      }
    } catch {
      // Keep the original URL if the page cannot offer a better file.
    }
  }
  if (hasExtension(deriveCandidateFilename(next))) return next;
  return applyProbeResult(next, await probeAssetMetadata(next));
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
  const askEveryTime = settings.savePreferences.folderBehavior === "always_ask";
  const flow = createPendingScanState(
    assets,
    activeTab.id,
    {
      dropbox: askEveryTime ? null : settings.lastUsedFolders.dropbox,
      google_drive: askEveryTime ? null : settings.lastUsedFolders.google_drive,
    },
    ["dropbox"],
  );
  await setPendingSave(flow);
  await openSaveWindow();
  return { ok: true, flow };
}

async function initializeContextMenus() {
  await chrome.contextMenus.removeAll();

  const parents: Array<{
    id: string;
    title: string;
    contexts: chrome.contextMenus.CreateProperties["contexts"];
  }> = [
    { id: MENU_IDS.image, title: parentMenuTitle("image"), contexts: ["image"] },
    { id: MENU_IDS.video, title: parentMenuTitle("video"), contexts: ["video"] },
    { id: MENU_IDS.audio, title: parentMenuTitle("audio"), contexts: ["audio"] },
    { id: MENU_IDS.link, title: parentMenuTitle("link"), contexts: ["link"] },
  ];

  for (const parent of parents) {
    chrome.contextMenus.create({
      id: parent.id,
      title: parent.title,
      contexts: parent.contexts,
    });
    for (const provider of listStorageProviders()) {
      chrome.contextMenus.create({
        id: providerMenuId(parent.id, provider.id),
        parentId: parent.id,
        title: provider.displayName,
        contexts: parent.contexts,
      });
    }
  }

  chrome.contextMenus.create({
    id: MENU_IDS.scan,
    title: "Find files on this page…",
    contexts: ["page", "selection"],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.preferences,
    title: "Save preferences",
    contexts: ["action"],
  });
}

export default defineBackground(() => {
  void initializeContextMenus();

  chrome.runtime.onInstalled.addListener((details) => {
    void initializeContextMenus();
    void chrome.runtime.setUninstallURL(UNINSTALL_FEEDBACK_URL);
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      void chrome.runtime.openOptionsPage();
    }
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
      if (info.menuItemId === MENU_IDS.preferences) {
        await openPreferencesTab();
        return;
      }

      if (info.menuItemId === MENU_IDS.scan) {
        const response = await startScanFlow();
        if (!response.ok) {
          await reportUnsupportedTarget(response.message, tab?.id);
        }
        return;
      }

      const parsed = parseProviderMenuId(String(info.menuItemId));
      if (!parsed) return;
      const { triggerKind, provider } = parsed;

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
            tab?.id,
          );
          return;
        }
        enrichedCandidate = { ...enrichedCandidate, detectedType: "link" };
      }

      const settings = await getSettings();
      const folderKey =
        settings.savePreferences.folderBehavior === "always_ask"
          ? null
          : settings.lastUsedFolders[provider];
      await queueSaveFlow({
        candidate: enrichedCandidate,
        provider,
        destinationPath: folderKey,
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
        case "GET_COMBINED_AUTH_STATE":
          sendResponse(await getCombinedAuthState());
          return;
        case "GET_GOOGLE_AUTH_STATE":
          sendResponse(await getGoogleDriveAuthState());
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
        case "CONNECT_GOOGLE_DRIVE":
          await connectGoogleDrive();
          sendResponse(await getGoogleDriveAuthState());
          return;
        case "DISCONNECT_GOOGLE_DRIVE":
          await disconnectGoogleDrive();
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
          sendResponse(await updateSettings(markUserSaveModeChoice(message.settings)));
          return;
        }
        case "LIST_FOLDERS": {
          const providerId = message.provider ?? "dropbox";
          sendResponse(await getStorageProvider(providerId).listFolders(message.path));
          return;
        }
        case "SET_LAST_USED_FOLDER": {
          const providerId = message.provider ?? "dropbox";
          const label = message.label
            ?? await getStorageProvider(providerId)
              .resolveFolderLabel(message.path ?? "")
              .catch(() => message.path);
          const settings = await setLastUsedFolder(providerId, message.path, label);
          const pending = await getPendingSave();
          if (pending?.mode === "single" && (pending.request.provider ?? "dropbox") === providerId) {
            await setPendingSave({
              ...pending,
              request: {
                ...pending.request,
                destinationPath: message.path,
                forceFolderPicker: false,
              },
            });
          } else if (pending?.mode === "scan") {
            await setPendingSave({
              ...pending,
              destinationPath: providerId === "dropbox" ? message.path : pending.destinationPath,
              destinations: {
                dropbox: pending.destinations?.dropbox ?? null,
                google_drive: pending.destinations?.google_drive ?? null,
                [providerId]: message.path,
              },
            });
          }
          sendResponse(settings);
          return;
        }
        case "RESOLVE_FOLDER_LABEL": {
          const providerId = message.provider ?? "dropbox";
          sendResponse(await getStorageProvider(providerId).resolveFolderLabel(message.path));
          return;
        }
        case "CREATE_FOLDER": {
          const providerId = message.provider ?? "dropbox";
          sendResponse(await createFolderAndSelect(message.parentPath, message.name, providerId));
          return;
        }
        case "GET_PENDING_SAVE":
          sendResponse(await getPendingSave());
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

          const providerId: StorageProviderId =
            message.provider
            ?? (pending.mode === "single" ? pending.request.provider : undefined)
            ?? "dropbox";

          if (pending.mode === "scan") {
            const selectedCandidate = message.candidate
              ? pending.assets.find((asset) => asset.sourceUrl === message.candidate?.sourceUrl)
              : undefined;
            if (!selectedCandidate) {
              sendResponse({
                ok: false,
                status: "unsupported",
                errorCode: "UNSUPPORTED_TARGET",
                message: "No supported asset was selected.",
              } satisfies SaveResult);
              return;
            }
            const result = await saveFromReviewWindow({
              candidate: selectedCandidate,
              provider: providerId,
              destinationPath: message.destinationPath,
              tabId: pending.tabId,
              finalFilename: message.finalFilename,
            });
            // A successful save clears the pending flow; keep the scan so the rest of the batch can save.
            await setPendingSave(pending);
            sendResponse(result);
            return;
          }

          sendResponse(
            await saveFromReviewWindow({
              ...pending.request,
              provider: providerId,
              destinationPath: message.destinationPath,
              finalFilename: message.finalFilename ?? pending.request.finalFilename,
            }),
          );
          return;
        }
        case "OPEN_FOLDER_SETTINGS":
          await openFolderSettingsWindow();
          sendResponse({ ok: true });
          return;
        case "GET_RECENT_SAVES":
          sendResponse(await getRecentSaves());
          return;
        case "CLEAR_RECENT_SAVES":
          await clearRecentSaves();
          sendResponse({ ok: true });
          return;
        case "START_SCAN_FLOW":
          sendResponse(await startScanFlow());
          return;
      }
    })().catch((error) => {
      sendResponse({
        backgroundError: true,
        message: error instanceof Error ? error.message : "Unexpected background error.",
      } satisfies BackgroundErrorResponse);
    });

    return true;
  });
});
