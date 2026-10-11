import { defineContentScript } from "wxt/utils/define-content-script";
import type {
  AssetCandidate,
  AssetDescriptionResponse,
  AssetFetchPayload,
  ContentScriptMessage,
} from "../lib/types";
import { MAX_TAB_TRANSFER_BYTES } from "../lib/constants";
import { detectAssetType } from "../lib/utils/asset";
import { arrayBufferToBase64 } from "../lib/utils/binary";

function safeResolveUrl(url: string): string | null {
  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return null;
  }
}

function extractElementHint(element: Element): string | null {
  const candidates = [
    element.getAttribute("download"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element instanceof HTMLImageElement ? element.alt : null,
    element.textContent,
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeAsset(url: string, mimeType?: string | null, element?: Element): AssetCandidate | null {
  if (!url) return null;
  const resolvedUrl = safeResolveUrl(url);
  if (!resolvedUrl) return null;
  const resolved = new URL(resolvedUrl);
  const downloadFilename = element instanceof HTMLAnchorElement ? element.getAttribute("download") : null;
  const detectedType = detectAssetType(resolved.toString());

  return {
    sourceUrl: resolved.toString(),
    pageUrl: window.location.href,
    detectedType: detectedType === "unknown" && downloadFilename ? "link" : detectedType,
    suggestedFilename: downloadFilename,
    preferredFilename: downloadFilename,
    elementTextHint: extractElementHint(element || document.body),
    requiresAuthenticatedFetch:
      resolved.origin === window.location.origin ||
      resolved.protocol === "blob:" ||
      resolved.protocol === "data:",
    referrer: window.location.href,
    mimeType,
    triggerKind: "scan",
  };
}

function isElementMatch(element: Element, url: string): boolean {
  if (element instanceof HTMLImageElement) return (element.currentSrc || element.src) === url;
  if (element instanceof HTMLVideoElement) return (element.currentSrc || element.src) === url;
  if (element instanceof HTMLAudioElement) return (element.currentSrc || element.src) === url;
  if (element instanceof HTMLSourceElement) return safeResolveUrl(element.src) === url;
  if (element instanceof HTMLAnchorElement) return safeResolveUrl(element.href) === url;
  return false;
}

function describeAssetTarget(url: string): AssetDescriptionResponse {
  const resolvedUrl = safeResolveUrl(url);
  if (!resolvedUrl) return {};

  const allElements = Array.from(
    document.querySelectorAll("img[src], video[src], video source[src], audio[src], audio source[src], a[href]"),
  );
  const matchingElement = allElements.find((element) => isElementMatch(element, resolvedUrl));
  if (!matchingElement) return {};

  return {
    preferredFilename:
      matchingElement instanceof HTMLAnchorElement
        ? matchingElement.getAttribute("download")
        : null,
    elementTextHint: extractElementHint(matchingElement),
    mimeType: matchingElement.getAttribute("type"),
    hasDownloadAttribute:
      matchingElement instanceof HTMLAnchorElement
        ? Boolean(matchingElement.getAttribute("download"))
        : false,
  };
}

function scanPageAssets(): AssetCandidate[] {
  const candidates = new Map<string, AssetCandidate>();

  document.querySelectorAll("img[src]").forEach((element) => {
    const asset = normalizeAsset(
      (element as HTMLImageElement).currentSrc || element.getAttribute("src") || "",
      "image/*",
      element,
    );
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("video[src], video source[src]").forEach((element) => {
    const url =
      element instanceof HTMLVideoElement
        ? element.currentSrc || element.getAttribute("src") || ""
        : element.getAttribute("src") || "";
    const asset = normalizeAsset(url, "video/*", element);
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("audio[src], audio source[src]").forEach((element) => {
    const url =
      element instanceof HTMLAudioElement
        ? element.currentSrc || element.getAttribute("src") || ""
        : element.getAttribute("src") || "";
    const asset = normalizeAsset(url, "audio/*", element);
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("a[href]").forEach((element) => {
    const asset = normalizeAsset(element.getAttribute("href") || "", null, element);
    if (asset && (asset.detectedType !== "unknown" || asset.preferredFilename)) {
      candidates.set(asset.sourceUrl, asset);
    }
  });

  return Array.from(candidates.values()).slice(0, 30);
}

async function fetchAssetBytes(url: string, referrer?: string): Promise<AssetFetchPayload> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      referrer: referrer || window.location.href,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        contentDispositionFilename: response.headers.get("content-disposition"),
        error: `Asset fetch failed (${response.status})`,
      };
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_TAB_TRANSFER_BYTES) {
      return {
        ok: false,
        status: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        error: "This file is too large to transfer from the page (over 40 MB).",
      };
    }
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      finalUrl: response.url,
      contentDispositionFilename: response.headers.get("content-disposition"),
      base64: arrayBufferToBase64(buffer),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      error: error instanceof Error ? error.message : "Page asset fetch failed.",
    };
  }
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: ContentScriptMessage, _sender, sendResponse) => {
      void (async () => {
        if (message.type === "PING") {
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "SCAN_PAGE_ASSETS") {
          sendResponse({ assets: scanPageAssets() });
          return;
        }

        if (message.type === "DESCRIBE_ASSET_TARGET") {
          sendResponse(describeAssetTarget(message.url));
          return;
        }

        if (message.type === "FETCH_ASSET_BYTES") {
          sendResponse(await fetchAssetBytes(message.url, message.referrer));
        }
      })();

      return true;
    });
  },
});
