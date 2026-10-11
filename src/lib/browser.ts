import type {
  AssetCandidate,
  AssetDescriptionResponse,
  AssetFetchPayload,
  BackgroundMessage,
  ContentScriptMessage,
  ScanPageAssetsResponse,
} from "./types";
import { base64ToArrayBuffer } from "./utils/binary";

export async function sendBackgroundMessage<T>(message: BackgroundMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
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

export async function scanActiveTabAssets(): Promise<AssetCandidate[]> {
  const tab = await getActiveTab();
  if (!tab?.id) return [];
  const response = await sendMessageToTab<ScanPageAssetsResponse>(tab.id, {
    type: "SCAN_PAGE_ASSETS",
  });
  return response.assets;
}

export async function fetchAssetBytesFromTab(
  tabId: number,
  url: string,
  referrer?: string,
): Promise<AssetFetchPayload> {
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
  return sendMessageToTab<AssetDescriptionResponse>(tabId, {
    type: "DESCRIBE_ASSET_TARGET",
    url,
  });
}
