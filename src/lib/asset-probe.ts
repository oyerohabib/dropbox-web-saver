import type { AssetCandidate } from "./types";
import { isHttpUrl } from "./utils/url";
import { normalizeMimeType, parseContentDispositionFilename } from "./utils/filename";

const PROBE_TIMEOUT_MS = 5_000;

export interface AssetProbeResult {
  contentType: string | null;
  contentDispositionFilename: string | null;
}

function readProbeHeaders(response: Response): AssetProbeResult {
  return {
    contentType: normalizeMimeType(response.headers.get("content-type")),
    contentDispositionFilename: parseContentDispositionFilename(
      response.headers.get("content-disposition"),
    ),
  };
}

async function probeWithRequest(
  url: string,
  init: RequestInit,
): Promise<AssetProbeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    const result = readProbeHeaders(response);
    return result.contentType || result.contentDispositionFilename ? result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function probeAssetMetadata(candidate: AssetCandidate): Promise<AssetProbeResult | null> {
  if (!isHttpUrl(candidate.sourceUrl)) return null;
  const credentials: RequestCredentials = candidate.requiresAuthenticatedFetch ? "include" : "omit";

  return (
    (await probeWithRequest(candidate.sourceUrl, { method: "HEAD", credentials }))
    ?? (await probeWithRequest(candidate.sourceUrl, {
      method: "GET",
      credentials,
      headers: { Range: "bytes=0-0" },
    }))
  );
}

export function applyProbeResult(
  candidate: AssetCandidate,
  probe: AssetProbeResult | null,
): AssetCandidate {
  if (!probe) return candidate;
  return {
    ...candidate,
    mimeType: probe.contentType ?? candidate.mimeType,
    contentDispositionFilename: probe.contentDispositionFilename ?? candidate.contentDispositionFilename,
  };
}
