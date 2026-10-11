import type {
  AssetCandidate,
  AssetDescriptionResponse,
  AssetFetchPayload,
  BackgroundMessage,
  ContentScriptMessage,
  ScanPageAssetsResponse,
} from "./types";

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
  return sendMessageToTab<AssetFetchPayload>(tabId, {
    type: "FETCH_ASSET_BYTES",
    url,
    referrer,
  });
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
