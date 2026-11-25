import { appendRecentSave, setLastResult, setLastUsedFolder, setPendingSave } from "./storage";
import { getStorageProvider, providerDisplayName } from "./providers";
import type {
  AssetCandidate,
  AssetFetchPayload,
  PendingScanState,
  PendingSaveState,
  PendingSingleSaveState,
  SaveRequest,
  SaveResult,
  StorageProviderId,
} from "./types";
import type { AssetProbeResult } from "./asset-probe";
import { applyProbeResult } from "./asset-probe";
import { detectAssetType } from "./utils/asset";
import {
  deriveCandidateFilename,
  hasExtension,
  normalizeMimeType,
  parseContentDispositionFilename,
  sanitizeFilename,
} from "./utils/filename";
import { SavePipelineError } from "./utils/errors";
import { canUseUrlImport } from "./utils/asset";
import { getDomain, getPatternHost } from "./utils/url";

function isAuthError(error: unknown): error is SavePipelineError {
  return (
    error instanceof SavePipelineError
    && (error.code === "TOKEN_EXPIRED" || error.code === "AUTH_REQUIRED")
  );
}

function resolveProviderId(request: SaveRequest): StorageProviderId {
  return request.provider ?? "dropbox";
}

export interface SaveDependencies {
  fetchAssetBytes: (candidate: AssetCandidate, tabId?: number) => Promise<AssetFetchPayload>;
  probeAssetMetadata?: (candidate: AssetCandidate) => Promise<AssetProbeResult | null>;
  /** Returns the origin pattern the user hasn't allowed yet for this URL, or null if access isn't the problem. */
  findMissingSitePermission?: (url: string) => Promise<string | null>;
  now?: () => number;
}

export function createPendingSave(
  request: SaveRequest,
  reason: PendingSingleSaveState["reason"],
  permissionOrigin?: string,
): PendingSaveState {
  const resolvedFilename = deriveCandidateFilename(request.candidate, request.finalFilename);
  return {
    mode: "single",
    request: {
      ...request,
      provider: resolveProviderId(request),
    },
    resolvedFilename,
    reason,
    permissionOrigin,
    createdAt: Date.now(),
  };
}

export function createPendingScanState(
  assets: AssetCandidate[],
  tabId?: number,
  destinations?: Partial<Record<StorageProviderId, string | null>>,
  selectedProviders: StorageProviderId[] = ["dropbox"],
): PendingScanState {
  const dropboxPath = destinations?.dropbox ?? null;
  return {
    mode: "scan",
    assets,
    tabId,
    destinationPath: dropboxPath,
    destinations: {
      dropbox: dropboxPath,
      google_drive: destinations?.google_drive ?? null,
    },
    selectedProviders,
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
  const providerId = resolveProviderId(request);
  const provider = getStorageProvider(providerId);
  const providerName = provider.displayName;

  try {
    const authState = await provider.getAuthState();
    if (
      authState.status === "missing_app_key"
      || authState.status === "missing_client_id"
      || authState.status === "signed_out"
    ) {
      const result: SaveResult = {
        ok: false,
        status: "needs_auth",
        provider: providerId,
        errorCode:
          authState.status === "missing_app_key"
            ? "APP_KEY_MISSING"
            : authState.status === "missing_client_id"
              ? "CLIENT_ID_MISSING"
              : "AUTH_REQUIRED",
        message:
          authState.status === "missing_app_key"
            ? "Add your Dropbox app key in the extension settings first."
            : authState.status === "missing_client_id"
              ? "This copy of Web Saver has no Google client id. Rebuild with WXT_GOOGLE_CLIENT_ID."
              : `Connect ${providerName} to continue.`,
      };
      await setLastResult(result);
      return result;
    }

    const destinationPath = request.destinationPath;
    if (!destinationPath) {
      const result: SaveResult = {
        ok: false,
        status: "needs_folder",
        provider: providerId,
        errorCode: "FOLDER_REQUIRED",
        message: `Choose a ${providerName} folder before saving.`,
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
        provider: providerId,
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

    let pathDisplay: string | undefined;
    let method: SaveResult["method"];

    if (provider.importFromUrl && canUseUrlImport(candidate)) {
      try {
        const imported = await provider.importFromUrl(destinationPath, filename, candidate.sourceUrl);
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
        const missingPermission =
          !assetPayload.ok && assetPayload.status === 0
            ? await dependencies.findMissingSitePermission?.(
                assetPayload.finalUrl || candidate.sourceUrl,
              )
            : null;
        if (missingPermission) {
          const result: SaveResult = {
            ok: false,
            status: "needs_permission",
            provider: providerId,
            errorCode: "SITE_PERMISSION_REQUIRED",
            filename,
            permissionOrigin: missingPermission,
            message: `Allow Web Saver to download files from ${getPatternHost(missingPermission)} to save this file.`,
          };
          await setLastResult(result);
          return result;
        }
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
      const uploaded = await provider.uploadFile(destinationPath, filename, assetPayload.arrayBuffer);
      pathDisplay = uploaded.pathDisplay;
      method = "direct_upload";
    }

    const folderLabel = await provider.resolveFolderLabel(destinationPath).catch(() =>
      provider.formatFolderLabel(destinationPath),
    );
    await setLastUsedFolder(providerId, destinationPath, folderLabel);
    const result: SaveResult = {
      ok: true,
      status: "success",
      method,
      path: pathDisplay,
      filename,
      provider: providerId,
      folderLabel,
      message: `Saved ${filename} to ${folderLabel}.`,
    };

    await appendRecentSave({
      id: crypto.randomUUID(),
      filename,
      sourceDomain: getDomain(request.candidate.pageUrl || request.candidate.sourceUrl),
      destinationPath,
      destinationLabel: folderLabel,
      success: true,
      timestamp: dependencies.now?.() ?? Date.now(),
      method,
      provider: providerId,
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
        provider: providerId,
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
    const destinationPath = request.destinationPath || provider.getRootFolderKey();
    const filename = request.finalFilename
      ? sanitizeFilename(request.finalFilename)
      : deriveCandidateFilename(request.candidate);
    const result: SaveResult = {
      ok: false,
      status: "failed",
      provider: providerId,
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
      provider: providerId,
      message: typedError.message,
    });
    await setLastResult(result);
    return result;
  }
}

export async function createFolderAndSelect(
  parentPath: string,
  name: string,
  providerId: StorageProviderId = "dropbox",
): Promise<string> {
  const provider = getStorageProvider(providerId);
  const folder = await provider.createFolder(parentPath, name);
  const folderKey = providerId === "dropbox" ? folder.pathDisplay : folder.id;
  const folderLabel = providerId === "dropbox" ? folder.pathDisplay : folder.name;
  await setLastUsedFolder(providerId, folderKey, folderLabel);
  return folderKey;
}

export { providerDisplayName };
