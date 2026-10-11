import type { AssetCandidate, AssetType } from "../types";
import { isLikelyDirectAssetUrl } from "./url";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

export function detectAssetType(url: string): AssetType {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();

  if (IMAGE_EXTENSIONS.test(pathname)) return "image";
  if (VIDEO_EXTENSIONS.test(pathname)) return "video";
  if (AUDIO_EXTENSIONS.test(pathname)) return "audio";
  if (isLikelyDirectAssetUrl(url)) return "link";
  return "unknown";
}

export function canUseUrlImport(candidate: AssetCandidate): boolean {
  if (candidate.requiresAuthenticatedFetch) return false;
  if (!/^https?:/i.test(candidate.sourceUrl)) return false;
  if (candidate.sourceUrl.startsWith("blob:") || candidate.sourceUrl.startsWith("data:")) return false;
  return true;
}
