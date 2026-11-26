import { defineContentScript } from "wxt/utils/define-content-script";
import type {
  AssetCandidate,
  AssetDescriptionResponse,
  AssetFetchPayload,
  AssetType,
  ContentScriptMessage,
} from "../lib/types";
import { MAX_TAB_TRANSFER_BYTES } from "../lib/constants";
import { detectAssetType, rankScannedAssets } from "../lib/utils/asset";
import {
  decodeEmbeddedMediaUrl,
  pickDownloadableMediaUrl,
  structuredMediaUrlsFromJsonLd,
} from "../lib/utils/media-url";
import { arrayBufferToBase64 } from "../lib/utils/binary";
import { showSaveToast } from "../lib/save-toast";

const MAX_SCANNED_ASSETS = 60;

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

function jsonLdTexts(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('script[type="application/ld+json"]')).map(
    (script) => script.textContent || "",
  );
}

let structuredHintsCache: { href: string; urls: string[] } | null = null;

async function collectStructuredMediaUrls(): Promise<string[]> {
  const href = window.location.href;
  const fromDom = structuredMediaUrlsFromJsonLd(jsonLdTexts(document), href);
  if (fromDom.length) return fromDom;
  if (structuredHintsCache?.href === href) return structuredHintsCache.urls;

  // In-app navigation leaves the previous pin's metadata in the DOM, so read this URL's own HTML.
  let urls: string[] = [];
  try {
    const response = await fetch(href, { credentials: "include" });
    if (response.ok) {
      const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
      urls = structuredMediaUrlsFromJsonLd(jsonLdTexts(parsed), href);
    }
  } catch {
    urls = [];
  }
  structuredHintsCache = { href, urls };
  return urls;
}

function primaryVideo(): HTMLVideoElement | undefined {
  return Array.from(document.querySelectorAll("video"))
    .map((video) => {
      const rect = video.getBoundingClientRect();
      return { video, area: rect.width * rect.height };
    })
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area)[0]?.video;
}

function collectPageMediaUrls(): string[] {
  const urls = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const resolved = safeResolveUrl(decodeEmbeddedMediaUrl(value));
    if (resolved) urls.add(resolved);
  };

  document.querySelectorAll("video, video source[src], audio, audio source[src]").forEach((element) => {
    if (element instanceof HTMLMediaElement) add(element.currentSrc || element.getAttribute("src"));
    else add(element.getAttribute("src"));
  });
  performance.getEntriesByType("resource").forEach((entry) => add(entry.name));

  const html = document.documentElement.innerHTML;
  const embedded = html.match(
    /https:\\?\/\\?\/[^"'\\\s<>]+(?:videos|\.mp4|\.webm|\.mov|\.m4v|\.m3u8)[^"'\\\s<>]*/gi,
  ) ?? [];
  for (const match of embedded) add(match);

  return [...urls];
}

async function collectIdentityHints(clickedUrl: string, element?: HTMLVideoElement): Promise<string[]> {
  const video =
    element
    ?? Array.from(document.querySelectorAll("video")).find(
      (candidate) => (candidate.currentSrc || candidate.src) === clickedUrl,
    );
  const isPrimary = !video || video === primaryVideo();
  return [
    video?.poster,
    ...(isPrimary ? await collectStructuredMediaUrls() : []),
  ].filter((value): value is string => Boolean(value));
}

async function resolveMediaDownloadUrl(url: string, element?: HTMLVideoElement): Promise<string> {
  const hints = await collectIdentityHints(url, element);
  return pickDownloadableMediaUrl(url, [...collectPageMediaUrls(), ...hints], hints);
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

function getElementSize(element: Element): { width?: number; height?: number } {
  if (element instanceof HTMLImageElement) {
    const width = element.naturalWidth || element.width;
    const height = element.naturalHeight || element.height;
    return width && height ? { width, height } : {};
  }
  const video = element instanceof HTMLSourceElement ? element.closest("video") : element;
  if (video instanceof HTMLVideoElement && video.videoWidth && video.videoHeight) {
    return { width: video.videoWidth, height: video.videoHeight };
  }
  return {};
}

async function scanPageAssets(): Promise<AssetCandidate[]> {
  const candidates = new Map<string, AssetCandidate>();

  document.querySelectorAll("img").forEach((element) => {
    if (isTinyImage(element)) return;
    const asset = normalizeAsset(getMediaUrl(element), element, "image");
    if (asset) candidates.set(asset.sourceUrl, { ...asset, ...getElementSize(element) });
  });

  for (const element of Array.from(document.querySelectorAll("video, video source[src]"))) {
    const asset = normalizeAsset(getMediaUrl(element), element, "video");
    if (!asset) continue;
    const video = element instanceof HTMLVideoElement ? element : element.closest("video") ?? undefined;
    const resolvedUrl = await resolveMediaDownloadUrl(asset.sourceUrl, video);
    // A player stream with no matching file can never be saved, so leave it out of the list.
    if (resolvedUrl.startsWith("blob:")) continue;
    candidates.set(resolvedUrl, {
      ...asset,
      sourceUrl: resolvedUrl,
      requiresAuthenticatedFetch: credentialsForUrl(resolvedUrl) === "include",
      ...getElementSize(element),
    });
  }

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

  return rankScannedAssets(Array.from(candidates.values())).slice(0, MAX_SCANNED_ASSETS);
}

function credentialsForUrl(url: string): RequestCredentials {
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? "include" : "omit";
  } catch {
    return "omit";
  }
}

async function fetchAssetBytes(url: string, referrer?: string): Promise<AssetFetchPayload> {
  try {
    const response = await fetch(url, {
      credentials: credentialsForUrl(url),
      referrer: referrer || window.location.href,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        contentDisposition: response.headers.get("content-disposition"),
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
      contentDisposition: response.headers.get("content-disposition"),
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
  registration: "runtime",
  matches: [],
  main() {
    chrome.runtime.onMessage.addListener((message: ContentScriptMessage, _sender, sendResponse) => {
      void (async () => {
        if (message.type === "PING") {
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "SCAN_PAGE_ASSETS") {
          sendResponse({ assets: await scanPageAssets() });
          return;
        }

        if (message.type === "DESCRIBE_ASSET_TARGET") {
          sendResponse(describeAssetTarget(message.url));
          return;
        }

        if (message.type === "RESOLVE_MEDIA_URL") {
          sendResponse({ url: await resolveMediaDownloadUrl(message.url) });
          return;
        }

        if (message.type === "FETCH_ASSET_BYTES") {
          sendResponse(await fetchAssetBytes(await resolveMediaDownloadUrl(message.url), message.referrer));
          return;
        }

        if (message.type === "SHOW_SAVE_STATUS") {
          showSaveToast(message.status);
          sendResponse({ ok: true });
        }
      })();

      return true;
    });
  },
});
