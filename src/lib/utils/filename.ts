import type { AssetCandidate } from "../types";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "video/mpeg": "mpeg",
  "video/ogg": "ogv",
  "video/3gpp": "3gp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/rtf": "rtf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/epub+zip": "epub",
  "application/zip": "zip",
  "application/vnd.rar": "rar",
  "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
  "application/x-tar": "tar",
  "application/gzip": "gz",
  "image/vnd.adobe.photoshop": "psd",
  "application/postscript": "eps",
};

const MAX_NAME_LENGTH = 80;

export function hasExtension(input: string): boolean {
  return /\.[a-z0-9]{2,8}$/i.test(input);
}

export function normalizeMimeType(mimeType?: string | null): string | null {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase();
  return normalized || null;
}

function getExtensionForMimeType(mimeType?: string | null): string | undefined {
  const normalized = normalizeMimeType(mimeType);
  return normalized ? MIME_EXTENSION_MAP[normalized] : undefined;
}

function appendExtensionIfMissing(input: string, mimeType?: string | null): string {
  const extension = getExtensionForMimeType(mimeType);
  if (!extension || hasExtension(input)) return input;
  return `${input}.${extension}`;
}

function limitNameLength(input: string): string {
  const collapsed = input.replace(/\s+/g, " ").trim();
  const extensionMatch = collapsed.match(/\.[a-z0-9]{2,8}$/i);
  const extension = extensionMatch?.[0] ?? "";
  const base = extension ? collapsed.slice(0, -extension.length) : collapsed;
  if (base.length <= MAX_NAME_LENGTH) return collapsed;
  return `${base.slice(0, MAX_NAME_LENGTH).trim()}${extension}`;
}

function buildName(input: string, mimeType?: string | null): string {
  return sanitizeFilename(appendExtensionIfMissing(limitNameLength(input), mimeType));
}

function extractLastUrlSegment(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "") || null;
  } catch {
    return null;
  }
}

export function sanitizeFilename(input: string): string {
  const cleaned = input.replace(/[\\/:*?"<>|]+/g, "-").trim();
  return cleaned || "asset";
}

export function deriveFilename(
  sourceUrl: string,
  suggestedFilename?: string | null,
  mimeType?: string | null,
  hints?: {
    preferredFilename?: string | null;
    contentDispositionFilename?: string | null;
    elementTextHint?: string | null;
  },
): string {
  const explicitCandidates = [
    hints?.preferredFilename,
    suggestedFilename,
  ];
  for (const candidate of explicitCandidates) {
    if (candidate?.trim()) {
      return buildName(candidate, mimeType);
    }
  }

  const lastSegment = extractLastUrlSegment(sourceUrl);
  if (lastSegment && hasExtension(lastSegment)) {
    return buildName(lastSegment);
  }
  if (hints?.contentDispositionFilename?.trim()) {
    return buildName(hints.contentDispositionFilename, mimeType);
  }
  if (hints?.elementTextHint?.trim()) {
    return buildName(hints.elementTextHint, mimeType);
  }
  if (lastSegment) {
    return buildName(lastSegment, mimeType);
  }

  const extension = getExtensionForMimeType(mimeType);
  return sanitizeFilename(extension ? `asset.${extension}` : "asset");
}

export function deriveCandidateFilename(
  candidate: AssetCandidate,
  finalFilename?: string | null,
): string {
  return deriveFilename(
    candidate.sourceUrl,
    finalFilename || candidate.suggestedFilename,
    candidate.mimeType,
    {
      preferredFilename: finalFilename || candidate.preferredFilename,
      contentDispositionFilename: candidate.contentDispositionFilename,
      elementTextHint: candidate.elementTextHint,
    },
  );
}

export function joinDropboxPath(folderPath: string, filename: string): string {
  const normalizedFolder = folderPath === "/" ? "" : folderPath.replace(/\/+$/, "");
  return `${normalizedFolder}/${filename}`.replace(/\/{2,}/g, "/");
}

export function parseContentDispositionFilename(headerValue?: string | null): string | null {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || null;
}
