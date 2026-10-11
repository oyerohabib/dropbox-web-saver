import { appendRecentSave, setLastResult, setPendingSave, updateSettings } from "./storage";
import { createFolder, saveUrlToDropbox, uploadFileToDropbox } from "./dropbox-api";
import { getAuthState } from "./dropbox-auth";
import type {
  AssetCandidate,
  AssetFetchPayload,
  PendingScanState,
  PendingSaveState,
  SaveRequest,
  SaveResult,
} from "./types";
import type { AssetProbeResult } from "./asset-probe";
import { applyProbeResult } from "./asset-probe";
import { detectAssetType } from "./utils/asset";
import {
  deriveCandidateFilename,
  hasExtension,
  joinDropboxPath,
  normalizeMimeType,
  parseContentDispositionFilename,
  sanitizeFilename,
} from "./utils/filename";
import { SavePipelineError } from "./utils/errors";
import { canUseUrlImport } from "./utils/asset";
import { getDomain } from "./utils/url";

function isAuthError(error: unknown): error is SavePipelineError {
  return (
    error instanceof SavePipelineError
    && (error.code === "TOKEN_EXPIRED" || error.code === "AUTH_REQUIRED")
  );
}

export interface SaveDependencies {
  fetchAssetBytes: (candidate: AssetCandidate, tabId?: number) => Promise<AssetFetchPayload>;
  probeAssetMetadata?: (candidate: AssetCandidate) => Promise<AssetProbeResult | null>;
  now?: () => number;
}

export function createPendingSave(
  request: SaveRequest,
  reason: "auth_required" | "folder_required" | "manual_override" | "context_review",
): PendingSaveState {
  const resolvedFilename = deriveCandidateFilename(request.candidate, request.finalFilename);
  return {
    mode: "single",
    request,
    resolvedFilename,
    reason,
    createdAt: Date.now(),
  };
}

export function createPendingScanState(
  assets: AssetCandidate[],
  tabId?: number,
  destinationPath?: string | null,
): PendingScanState {
  return {
    mode: "scan",
    assets,
    tabId,
    destinationPath,
    selectedSourceUrl: null,
    selectedFilename: null,
    createdAt: Date.now(),
    reason: "scan",
  };
}

export async function saveAsset(
  request: SaveRequest,
  dependencies: SaveDependencies,
): Promise<SaveResult> {
  try {
    const authState = await getAuthState();
    if (authState.status === "missing_app_key" || authState.status === "signed_out") {
      const result: SaveResult = {
        ok: false,
        status: "needs_auth",
        errorCode: authState.status === "missing_app_key" ? "APP_KEY_MISSING" : "AUTH_REQUIRED",
        message:
          authState.status === "missing_app_key"
            ? "Add your Dropbox app key in the extension settings first."
            : "Connect Dropbox to continue.",
      };
      await setLastResult(result);
      return result;
    }

    const destinationPath = request.destinationPath;
    if (!destinationPath) {
      const result: SaveResult = {
        ok: false,
        status: "needs_folder",
        errorCode: "FOLDER_REQUIRED",
        message: "Choose a Dropbox folder before saving.",
      };
      await setLastResult(result);
      return result;
    }

    const detectedType =
      request.candidate.detectedType === "unknown"
        ? detectAssetType(request.candidate.sourceUrl)
        : request.candidate.detectedType;
    if (detectedType === "unknown") {
      const result: SaveResult = {
        ok: false,
        status: "unsupported",
        errorCode: "UNSUPPORTED_TARGET",
        message: "This target does not look like a downloadable file or media asset.",
      };
      await setLastResult(result);
      return result;
    }

    let candidate = request.candidate;
    let filename = deriveCandidateFilename(candidate, request.finalFilename);
    if (!hasExtension(filename) && dependencies.probeAssetMetadata) {
      candidate = applyProbeResult(candidate, await dependencies.probeAssetMetadata(candidate));
      filename = deriveCandidateFilename(candidate, request.finalFilename);
    }
    let dropboxPath = joinDropboxPath(destinationPath, filename);

    let pathDisplay: string | undefined;
    let method: SaveResult["method"];

    if (canUseUrlImport(candidate)) {
      try {
        const imported = await saveUrlToDropbox(dropboxPath, candidate.sourceUrl);
        pathDisplay = imported.pathDisplay;
        method = "url_import";
      } catch (error) {
        if (isAuthError(error) || (error instanceof SavePipelineError && error.code === "FOLDER_NOT_FOUND")) {
          throw error;
        }
        method = undefined;
      }
    }

    if (!pathDisplay) {
      const assetPayload = await dependencies.fetchAssetBytes(candidate, request.tabId);
      if (
        !assetPayload.ok
        || !(assetPayload.arrayBuffer instanceof ArrayBuffer)
        || assetPayload.arrayBuffer.byteLength === 0
      ) {
        throw new SavePipelineError(
          assetPayload.error || "Could not fetch the source asset from the page.",
          "ASSET_FETCH_FAILED",
        );
      }
      filename = deriveCandidateFilename(
        {
          ...candidate,
          sourceUrl: assetPayload.finalUrl || candidate.sourceUrl,
          mimeType: normalizeMimeType(assetPayload.contentType) ?? candidate.mimeType,
          contentDispositionFilename:
            parseContentDispositionFilename(assetPayload.contentDisposition)
            ?? candidate.contentDispositionFilename,
        },
        request.finalFilename,
      );
      dropboxPath = joinDropboxPath(destinationPath, filename);
      const uploaded = await uploadFileToDropbox(dropboxPath, assetPayload.arrayBuffer);
      pathDisplay = uploaded.pathDisplay;
      method = "direct_upload";
    }

    await updateSettings({ lastUsedFolderPath: destinationPath });
    const result: SaveResult = {
      ok: true,
      status: "success",
      method,
      path: pathDisplay,
      filename,
      message: `Saved ${filename} to ${destinationPath}.`,
    };

    await appendRecentSave({
      id: crypto.randomUUID(),
      filename,
      sourceDomain: getDomain(request.candidate.pageUrl || request.candidate.sourceUrl),
      destinationPath,
      success: true,
      timestamp: dependencies.now?.() ?? Date.now(),
      method,
      message: result.message,
    });
    await setLastResult(result);
    await setPendingSave(null);
    return result;
  } catch (error) {
    if (isAuthError(error)) {
      const result: SaveResult = {
        ok: false,
        status: "needs_auth",
        errorCode: error.code,
        message: error.message,
      };
      await setLastResult(result);
      return result;
    }

    const typedError =
      error instanceof SavePipelineError
        ? error
        : new SavePipelineError(
            error instanceof Error ? error.message : "Unexpected save error.",
            "UNKNOWN",
          );
    const destinationPath = request.destinationPath || "/";
    const filename = request.finalFilename
      ? sanitizeFilename(request.finalFilename)
      : deriveCandidateFilename(request.candidate);
    const result: SaveResult = {
      ok: false,
      status: "failed",
      errorCode: typedError.code,
      filename,
      message: typedError.message,
    };
    await appendRecentSave({
      id: crypto.randomUUID(),
      filename,
      sourceDomain: getDomain(request.candidate.pageUrl || request.candidate.sourceUrl),
      destinationPath,
      success: false,
      timestamp: dependencies.now?.() ?? Date.now(),
      message: typedError.message,
    });
    await setLastResult(result);
    return result;
  }
}

export async function createFolderAndSelect(parentPath: string, name: string): Promise<string> {
  const folder = await createFolder(parentPath, name);
  await updateSettings({ lastUsedFolderPath: folder.pathDisplay });
  return folder.pathDisplay;
}
