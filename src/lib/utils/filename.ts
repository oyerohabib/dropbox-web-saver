const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

function hasExtension(input: string): boolean {
  return /\.[a-z0-9]{2,8}$/i.test(input);
}

function getExtensionForMimeType(mimeType?: string | null): string | undefined {
  return mimeType ? MIME_EXTENSION_MAP[mimeType.toLowerCase()] : undefined;
}

function appendExtensionIfMissing(input: string, mimeType?: string | null): string {
  const extension = getExtensionForMimeType(mimeType);
  if (!extension || hasExtension(input)) return input;
  return `${input}.${extension}`;
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
      return sanitizeFilename(appendExtensionIfMissing(candidate.trim(), mimeType));
    }
  }

  const lastSegment = extractLastUrlSegment(sourceUrl);
  if (lastSegment && hasExtension(lastSegment)) {
    return sanitizeFilename(lastSegment);
  }
  if (hints?.contentDispositionFilename?.trim()) {
    return sanitizeFilename(
      appendExtensionIfMissing(hints.contentDispositionFilename.trim(), mimeType),
    );
  }
  if (hints?.elementTextHint?.trim()) {
    return sanitizeFilename(appendExtensionIfMissing(hints.elementTextHint.trim(), mimeType));
  }
  if (lastSegment) {
    return sanitizeFilename(appendExtensionIfMissing(lastSegment, mimeType));
  }

  const extension = getExtensionForMimeType(mimeType);
  return sanitizeFilename(extension ? `asset.${extension}` : "asset");
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
