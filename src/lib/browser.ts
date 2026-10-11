import type {
  AssetDescriptionResponse,
  AssetFetchPayload,
  BackgroundErrorResponse,
  BackgroundMessage,
  ContentScriptMessage,
} from "./types";
import type { FeedbackKind } from "./project";
import { base64ToArrayBuffer } from "./utils/binary";

const CONTENT_SCRIPT_FILE = "content-scripts/content.js";

export async function sendBackgroundMessage<T>(message: BackgroundMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as T | BackgroundErrorResponse;
  if (response && typeof response === "object" && "backgroundError" in response) {
    throw new Error(response.message);
  }
  return response as T;
}

export async function sendMessageToTab<T>(
  tabId: number,
  message: ContentScriptMessage,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function openSettingsTab(section: "setup" | "preferences" | "recent-saves") {
  return chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#${section}`) });
}

export function openPreferencesTab() {
  return openSettingsTab("preferences");
}

export function openFeedbackTab(prefill: { kind?: FeedbackKind; title?: string; message?: string } = {}) {
  const params = new URLSearchParams(
    Object.entries(prefill).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const query = params.toString();
  return chrome.tabs.create({ url: chrome.runtime.getURL(`feedback.html${query ? `?${query}` : ""}`) });
}

export class RestrictedPageError extends Error {
  constructor() {
    super("Web Saver can't run on this page. Try a regular website tab.");
  }
}

/** Must be called from a click handler: Chrome only shows the permission prompt in response to a user gesture. */
export function requestSitePermissions(origins: string[]): Promise<boolean> {
  return chrome.permissions.request({ origins });
}

export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const response = await sendMessageToTab<{ ok?: boolean } | undefined>(tabId, { type: "PING" });
    if (response?.ok) return;
  } catch {
    // No listener in this tab yet (opened before the extension was installed or reloaded).
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });
  } catch {
    throw new RestrictedPageError();
  }
}

export async function fetchAssetBytesFromTab(
  tabId: number,
  url: string,
  referrer?: string,
): Promise<AssetFetchPayload> {
  await ensureContentScript(tabId);
  const { base64, ...payload } = await sendMessageToTab<AssetFetchPayload>(tabId, {
    type: "FETCH_ASSET_BYTES",
    url,
    referrer,
  });
  return base64 ? { ...payload, arrayBuffer: base64ToArrayBuffer(base64) } : payload;
}

export async function describeAssetTargetInTab(
  tabId: number,
  url: string,
): Promise<AssetDescriptionResponse> {
  await ensureContentScript(tabId);
  return sendMessageToTab<AssetDescriptionResponse>(tabId, {
    type: "DESCRIBE_ASSET_TARGET",
    url,
  });
}
