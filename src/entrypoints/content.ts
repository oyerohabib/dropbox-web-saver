import { defineContentScript } from "wxt/utils/define-content-script";
import type {
  AssetCandidate,
  AssetDescriptionResponse,
  AssetFetchPayload,
  AssetType,
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

function normalizeAsset(
  url: string,
  element: Element,
  elementType?: Exclude<AssetType, "link" | "unknown">,
): AssetCandidate | null {
  if (!url) return null;
  const resolvedUrl = safeResolveUrl(url);
  if (!resolvedUrl) return null;
  const resolved = new URL(resolvedUrl);
  if (resolved.protocol === "data:") return null;
  const downloadFilename = element instanceof HTMLAnchorElement ? element.getAttribute("download") : null;
  const urlType = detectAssetType(resolved.toString());

  return {
    sourceUrl: resolved.toString(),
    pageUrl: window.location.href,
    detectedType: elementType ?? (urlType === "unknown" && downloadFilename ? "link" : urlType),
    suggestedFilename: downloadFilename,
    preferredFilename: downloadFilename,
    elementTextHint: extractElementHint(element),
    requiresAuthenticatedFetch:
      resolved.origin === window.location.origin ||
      resolved.protocol === "blob:",
    referrer: window.location.href,
    mimeType: element instanceof HTMLSourceElement ? element.type || null : null,
    triggerKind: "scan",
  };
}

function getMediaUrl(element: Element): string {
  if (element instanceof HTMLImageElement) {
    return element.currentSrc || element.getAttribute("src") || element.getAttribute("data-src") || "";
  }
  if (element instanceof HTMLMediaElement) {
    return element.currentSrc || element.getAttribute("src") || "";
  }
  return element.getAttribute("src") || "";
}

// Skips tracking pixels, spacers, and icons that are never what the user wants to save.
function isTinyImage(element: HTMLImageElement): boolean {
  return element.complete && element.naturalWidth > 0 && element.naturalWidth < 32 && element.naturalHeight < 32;
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
    document.querySelectorAll("img, video, video source[src], audio, audio source[src], a[href]"),
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

  document.querySelectorAll("img").forEach((element) => {
    if (isTinyImage(element)) return;
    const asset = normalizeAsset(getMediaUrl(element), element, "image");
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("video, video source[src]").forEach((element) => {
    const asset = normalizeAsset(getMediaUrl(element), element, "video");
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("audio, audio source[src]").forEach((element) => {
    const asset = normalizeAsset(getMediaUrl(element), element, "audio");
    if (asset) candidates.set(asset.sourceUrl, asset);
  });

  document.querySelectorAll("a[href]").forEach((element) => {
    const asset = normalizeAsset(element.getAttribute("href") || "", element);
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
