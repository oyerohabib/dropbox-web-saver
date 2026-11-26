const STREAM_PATTERN = /\.(m3u8|mpd)(?:$|\?)/i;
const FILE_PATTERN = /\.(mp4|m4v|webm|mov)(?:$|\?)/i;

export function isStreamedMediaUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:") || STREAM_PATTERN.test(url);
}

export function decodeEmbeddedMediaUrl(value: string): string {
  return value
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u003[dD]/g, "=")
    .replace(/\\\//g, "/");
}

export function mediaIdentityKey(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const nested = path.match(/\/(?:[0-9a-f]{2}\/){3}([0-9a-f]{16,})/i);
    if (nested) return nested[1].toLowerCase();
    const hex = path.match(/([0-9a-f]{16,})/i);
    return hex ? hex[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function scoreDownloadableMediaUrl(url: string): number {
  if (url.startsWith("blob:") || url.startsWith("data:")) return -100;
  if (STREAM_PATTERN.test(url)) return 1;
  let score = 0;
  if (FILE_PATTERN.test(url)) score += 40;
  if (/\/(?:720p|orig)\//i.test(url)) score += 35;
  else if (/expmp4/i.test(url)) score += 15;
  if (/av1|hevc/i.test(url)) score -= 20;
  const width = url.match(/(\d{3,4})w/i) ?? url.match(/\/(\d{3,4})p\//i) ?? url.match(/(\d{3,4})p/i);
  if (width) score += Math.min(Number(width[1]), 2160) / 10;
  return score;
}

export function pickDownloadableMediaUrl(
  clickedUrl: string,
  candidates: string[],
  identityHints: string[] = [],
): string {
  if (
    /^https?:/i.test(clickedUrl)
    && !isStreamedMediaUrl(clickedUrl)
    && FILE_PATTERN.test(clickedUrl)
  ) {
    return clickedUrl;
  }

  const identityKeys = new Set(
    [clickedUrl, ...identityHints]
      .map((url) => mediaIdentityKey(url))
      .filter((key): key is string => Boolean(key)),
  );

  const ranked = [...new Set([...identityHints, ...candidates])]
    .filter((url) => /^https?:/i.test(url) && FILE_PATTERN.test(url))
    .map((url) => {
      const key = mediaIdentityKey(url);
      return { url, key, identityMatch: Boolean(key && identityKeys.has(key)), score: scoreDownloadableMediaUrl(url) };
    })
    .sort((a, b) => b.score - a.score);

  const matching = ranked.find((item) => item.identityMatch);
  if (matching) return matching.url;

  // Guessing is only safe with no hints and a single video on the page; otherwise a related pin could be saved.
  if (identityHints.length) return clickedUrl;
  const distinctVideos = new Set(ranked.map((item) => item.key ?? item.url));
  return distinctVideos.size === 1 ? ranked[0].url : clickedUrl;
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function flattenJsonLd(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.flatMap(flattenJsonLd);
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return record["@graph"] ? [data, ...flattenJsonLd(record["@graph"])] : [data];
  }
  return [];
}

function pageIdentityTokens(pageUrl: string): string[] {
  try {
    const path = new URL(pageUrl).pathname;
    const pin = path.match(/\/pin\/([^/]+)/i);
    if (!pin) return [];
    const slug = decodeURIComponent(pin[1]).replace(/\/$/, "");
    const numeric = slug.match(/(\d{10,})/);
    return numeric ? [numeric[1], slug] : [slug];
  } catch {
    return [];
  }
}

export function structuredMediaUrlsFromJsonLd(texts: string[], pageUrl = ""): string[] {
  const tokens = pageIdentityTokens(pageUrl);
  const primary: string[] = [];
  const other: string[] = [];

  for (const text of texts) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }

    for (const node of flattenJsonLd(data)) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      const types = asArray(record["@type"]).map(String);
      if (!types.some((type) => /VideoObject|ImageObject/i.test(type))) continue;

      const contentUrl = typeof record.contentUrl === "string" ? record.contentUrl : null;
      const thumbnailUrl = typeof record.thumbnailUrl === "string" ? record.thumbnailUrl : null;
      const id = String(record["@id"] ?? record.url ?? "");
      const isPrimary = tokens.some(
        (token) => id.includes(token) || Boolean(contentUrl && contentUrl.includes(token)),
      );
      const bucket = isPrimary ? primary : other;
      if (contentUrl) bucket.push(contentUrl);
      if (thumbnailUrl) bucket.push(thumbnailUrl);
    }
  }

  // On a pin page, metadata for any other pin is stale from in-app navigation.
  return tokens.length ? primary : [...primary, ...other];
}
