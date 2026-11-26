import { useEffect, useState } from "react";
import { ProviderMark, ProviderName } from "../../components/BrandMarks";
import { DropboxConnectCard } from "../../components/DropboxConnectCard";
import { FolderPicker } from "../../components/FolderPicker";
import { GoogleDriveConnectCard } from "../../components/GoogleDriveConnectCard";
import { Button, Spinner, StatusMessage, type StatusTone } from "../../components/ui";
import {
  openFeedbackTab,
  openPreferencesTab,
  openSettingsTab,
  requestSitePermissions,
  sendBackgroundMessage,
} from "../../lib/browser";
import { getStorageProvider, listStorageProviders, providerDisplayName } from "../../lib/providers";
import { isSmallAsset } from "../../lib/utils/asset";
import { summarizeBatch, type BatchItemResult, type BatchSummary } from "../../lib/utils/batch";
import { deriveCandidateFilename } from "../../lib/utils/filename";
import { defaultScanDestinations } from "../../lib/utils/scan-destinations";
import { getDomain, getPatternHost } from "../../lib/utils/url";
import type {
  AssetCandidate,
  CombinedAuthState,
  DropboxAuthState,
  ExtensionSettings,
  GoogleDriveAuthState,
  PendingSaveState,
  SavePreferences,
  SaveResult,
  StorageProviderId,
} from "../../lib/types";

const SUCCESS_CLOSE_DELAY_MS = 1_200;
const KEPT_REVIEWING_CLOSE_DELAY_MS = 1_800;

const ASSET_TYPE_ICONS: Record<AssetCandidate["detectedType"], string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  link: "📄",
  unknown: "📄",
};

function getReviewCandidate(flow: PendingSaveState | null, selectedAssets: AssetCandidate[]): AssetCandidate | null {
  if (!flow) return null;
  if (flow.mode === "single") return flow.request.candidate;
  return selectedAssets.length === 1 ? selectedAssets[0] : null;
}

function pluralizeFiles(count: number): string {
  return `${count} file${count === 1 ? "" : "s"}`;
}

function describeAsset(asset: AssetCandidate): string {
  const type = asset.detectedType === "link" || asset.detectedType === "unknown" ? "file" : asset.detectedType;
  const size = asset.width && asset.height ? `${asset.width} × ${asset.height}` : null;
  return [type, size, getDomain(asset.sourceUrl)].filter(Boolean).join(" · ");
}

function AssetThumb({ asset }: { asset: AssetCandidate }) {
  const [failed, setFailed] = useState(false);
  if (asset.detectedType === "image" && !failed) {
    return (
      <img
        alt=""
        className="asset-thumb"
        loading="lazy"
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
        src={asset.sourceUrl}
      />
    );
  }
  return (
    <span aria-hidden="true" className="asset-thumb asset-thumb-icon">
      {ASSET_TYPE_ICONS[asset.detectedType]}
    </span>
  );
}

type DestinationMap = Record<StorageProviderId, string | null>;

function emptyDestinations(): DestinationMap {
  return { dropbox: null, google_drive: null };
}

function folderLabel(
  provider: StorageProviderId,
  folderKey: string | null,
  knownLabel?: string | null,
): string {
  if (knownLabel) return knownLabel;
  const storage = getStorageProvider(provider);
  return storage.formatFolderLabel(folderKey || storage.getRootFolderKey());
}

export function SaveApp() {
  const [combinedAuth, setCombinedAuth] = useState<CombinedAuthState | null>(null);
  const [saveFlow, setSaveFlow] = useState<PendingSaveState | null>(null);
  const [destinations, setDestinations] = useState<DestinationMap>(emptyDestinations);
  const [destinationLabels, setDestinationLabels] = useState<DestinationMap>(emptyDestinations);
  const [selectedProviders, setSelectedProviders] = useState<StorageProviderId[]>(["google_drive"]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set());
  const [showSmallImages, setShowSmallImages] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResult, setBatchResult] = useState<(BatchSummary & {
    destinations: DestinationMap;
    providers: StorageProviderId[];
  }) | null>(null);
  const [permissionOrigins, setPermissionOrigins] = useState<string[]>([]);
  const [filenameDraft, setFilenameDraft] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<StorageProviderId | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTo, setSavedTo] = useState<{
    provider: StorageProviderId;
    folderPath: string;
    folderLabel: string;
    filename: string;
    switchedToInstant: boolean;
  } | null>(null);
  const [keptReviewing, setKeptReviewing] = useState(false);
  const [keepingReview, setKeepingReview] = useState(false);
  const [changingFolderFor, setChangingFolderFor] = useState<StorageProviderId | null>(null);
  const [savePreferences, setSavePreferences] = useState<SavePreferences | null>(null);
  const [defaultFolders, setDefaultFolders] = useState<DestinationMap>(emptyDestinations);
  const [defaultSavedProvider, setDefaultSavedProvider] = useState<StorageProviderId | null>(null);

  const singleProvider: StorageProviderId =
    saveFlow?.mode === "single" ? (saveFlow.request.provider ?? "dropbox") : "dropbox";
  const activeProviders: StorageProviderId[] =
    saveFlow?.mode === "scan" ? selectedProviders : saveFlow?.mode === "single" ? [singleProvider] : ["dropbox"];

  async function load(options: { resetProviders?: boolean } = {}) {
    const [nextAuth, nextSaveFlow, settings] = await Promise.all([
      sendBackgroundMessage<CombinedAuthState>({ type: "GET_COMBINED_AUTH_STATE" }),
      sendBackgroundMessage<PendingSaveState | null>({ type: "GET_PENDING_SAVE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ]);
    setCombinedAuth(nextAuth);
    setSaveFlow(nextSaveFlow);
    setPermissionOrigins(
      nextSaveFlow?.mode === "single" && nextSaveFlow.permissionOrigin ? [nextSaveFlow.permissionOrigin] : [],
    );
    setSavePreferences(settings.savePreferences);
    setDefaultFolders({ ...settings.lastUsedFolders });

    const nextDestinations: DestinationMap = {
      dropbox:
        nextSaveFlow?.mode === "scan"
          ? nextSaveFlow.destinations?.dropbox ?? nextSaveFlow.destinationPath ?? settings.lastUsedFolders.dropbox
          : nextSaveFlow?.mode === "single" && nextSaveFlow.request.provider === "dropbox"
            ? nextSaveFlow.request.destinationPath ?? settings.lastUsedFolders.dropbox
            : settings.lastUsedFolders.dropbox,
      google_drive:
        nextSaveFlow?.mode === "scan"
          ? nextSaveFlow.destinations?.google_drive ?? settings.lastUsedFolders.google_drive
          : nextSaveFlow?.mode === "single" && nextSaveFlow.request.provider === "google_drive"
            ? nextSaveFlow.request.destinationPath ?? settings.lastUsedFolders.google_drive
            : settings.lastUsedFolders.google_drive,
    };
    setDestinations(nextDestinations);
    setDestinationLabels({
      dropbox:
        nextDestinations.dropbox === settings.lastUsedFolders.dropbox
          ? settings.lastUsedFolderLabels.dropbox ?? nextDestinations.dropbox
          : nextDestinations.dropbox,
      google_drive:
        nextDestinations.google_drive === settings.lastUsedFolders.google_drive
          ? settings.lastUsedFolderLabels.google_drive
          : null,
    });

    if (nextSaveFlow?.mode === "scan" && options.resetProviders !== false) {
      setSelectedProviders(
        nextSaveFlow.selectedProviders?.length
          ? nextSaveFlow.selectedProviders
          : defaultScanDestinations({
              dropboxConnected: nextAuth.dropbox.status === "signed_in",
              driveConnected:
                nextAuth.googleDrive.status === "signed_in" && !nextAuth.googleDrive.needsReconnect,
              lastUsedProvider: settings.lastUsedProvider,
            }),
      );
    }

    setFilenameDraft(
      nextSaveFlow?.mode === "single"
        ? nextSaveFlow.request.finalFilename
          || nextSaveFlow.resolvedFilename
          || deriveCandidateFilename(nextSaveFlow.request.candidate, nextSaveFlow.request.finalFilename)
        : "",
    );

    if (nextSaveFlow?.mode === "single") {
      const provider = nextSaveFlow.request.provider ?? "dropbox";
      const folder = nextDestinations[provider];
      setChangingFolderFor(
        nextSaveFlow.request.forceFolderPicker || !folder ? provider : null,
      );
    } else if (!nextSaveFlow) {
      setChangingFolderFor("dropbox");
    } else {
      setChangingFolderFor(null);
    }
  }

  useEffect(() => {
    load()
      .catch((error) => {
        setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not load this save." });
      })
      .finally(() => setLoaded(true));
  }, []);

  const scanAssets = saveFlow?.mode === "scan" ? saveFlow.assets : [];
  const smallImageCount = scanAssets.filter(isSmallAsset).length;
  const visibleAssets = showSmallImages ? scanAssets : scanAssets.filter((asset) => !isSmallAsset(asset));
  const selectedAssets = scanAssets.filter((asset) => selectedUrls.has(asset.sourceUrl));
  const reviewCandidate = getReviewCandidate(saveFlow, selectedAssets);
  const resolvedFilename = reviewCandidate ? deriveCandidateFilename(reviewCandidate) : null;
  const shouldPromptForRename = savePreferences?.promptForRename ?? false;

  useEffect(() => {
    if (saveFlow?.mode === "scan" && resolvedFilename) {
      setFilenameDraft(resolvedFilename);
    }
  }, [resolvedFilename, saveFlow?.mode]);

  function toggleAsset(sourceUrl: string) {
    setSelectedUrls((current) => {
      const next = new Set(current);
      if (next.has(sourceUrl)) next.delete(sourceUrl);
      else next.add(sourceUrl);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedUrls((current) => new Set([...current, ...visibleAssets.map((asset) => asset.sourceUrl)]));
  }

  function toggleSmallImages(show: boolean) {
    setShowSmallImages(show);
    if (!show) {
      const smallUrls = new Set(scanAssets.filter(isSmallAsset).map((asset) => asset.sourceUrl));
      setSelectedUrls((current) => new Set([...current].filter((url) => !smallUrls.has(url))));
    }
  }

  function toggleProvider(provider: StorageProviderId) {
    setSelectedProviders((current) => {
      if (current.includes(provider)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== provider);
      }
      return [...current, provider];
    });
  }

  function authFor(provider: StorageProviderId): DropboxAuthState | GoogleDriveAuthState | null {
    if (!combinedAuth) return null;
    return provider === "dropbox" ? combinedAuth.dropbox : combinedAuth.googleDrive;
  }

  function isSignedIn(provider: StorageProviderId): boolean {
    return authFor(provider)?.status === "signed_in";
  }

  async function connect(provider: StorageProviderId) {
    setConnectingProvider(provider);
    try {
      if (provider === "dropbox") {
        await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
        setStatus({ tone: "success", text: "Dropbox connected." });
      } else {
        await sendBackgroundMessage<GoogleDriveAuthState>({ type: "CONNECT_GOOGLE_DRIVE" });
        setStatus({ tone: "success", text: "Google Drive connected." });
      }
      await load({ resetProviders: false });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : `${providerDisplayName(provider)} connection failed.`,
      });
    } finally {
      setConnectingProvider(null);
    }
  }

  async function saveDefaultFolder(provider: StorageProviderId, path: string, label: string) {
    setSaving(true);
    setStatus(null);
    try {
      await sendBackgroundMessage<ExtensionSettings>({
        type: "SET_LAST_USED_FOLDER",
        path,
        provider,
        label,
      });
      setDestinations((current) => ({ ...current, [provider]: path }));
      setDestinationLabels((current) => ({ ...current, [provider]: label }));
      setDefaultFolders((current) => ({ ...current, [provider]: path }));
      setDefaultSavedProvider(provider);
      setChangingFolderFor(null);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not save the default folder." });
    } finally {
      setSaving(false);
    }
  }

  async function completeSave() {
    const folderPath = destinations[singleProvider];
    if (!folderPath || !saveFlow) return;
    try {
      if (!reviewCandidate) {
        setStatus({ tone: "error", text: "No file is selected for saving." });
        return;
      }

      setSaving(true);
      const result = await sendBackgroundMessage<SaveResult>({
        type: "SAVE_PENDING",
        destinationPath: folderPath,
        provider: singleProvider,
        finalFilename: filenameDraft.trim() || resolvedFilename,
      });
      if (result.ok) {
        const switchedToInstant = Boolean(result.switchedToInstant);
        setSavedTo({
          provider: singleProvider,
          folderPath,
          folderLabel: result.folderLabel || destinationLabels[singleProvider] || folderLabel(singleProvider, folderPath),
          filename: result.filename ?? filenameDraft,
          switchedToInstant,
        });
        if (!switchedToInstant) {
          setTimeout(() => window.close(), SUCCESS_CLOSE_DELAY_MS);
        }
      } else if (result.status === "needs_permission" && result.permissionOrigin) {
        setPermissionOrigins([result.permissionOrigin]);
      } else if (result.status === "needs_auth") {
        setStatus({ tone: "error", text: result.message });
        const nextAuth = await sendBackgroundMessage<CombinedAuthState>({ type: "GET_COMBINED_AUTH_STATE" });
        setCombinedAuth(nextAuth);
      } else {
        setStatus({ tone: "error", text: result.message });
      }
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "The save request failed." });
    } finally {
      setSaving(false);
    }
  }

  async function allowAndSave() {
    setStatus(null);
    if (!(await requestSitePermissions(permissionOrigins))) {
      setStatus({ tone: "warning", text: "This file can't be saved without access to its site." });
      return;
    }
    setPermissionOrigins([]);
    await completeSave();
  }

  async function allowAndRetryBatch(summary: BatchSummary & { destinations: DestinationMap; providers: StorageProviderId[] }) {
    if (!(await requestSitePermissions(summary.permissionOrigins))) return;
    await saveBatch(
      summary.failures.map((failure) => failure.asset),
      summary,
    );
  }

  async function saveBatch(
    assets: AssetCandidate[],
    previous?: BatchSummary & { destinations: DestinationMap; providers: StorageProviderId[] },
  ) {
    const providers = previous?.providers ?? selectedProviders;
    if (!assets.length || !providers.length) return;
    for (const provider of providers) {
      if (!destinations[provider]) {
        setStatus({ tone: "error", text: `Choose a ${providerDisplayName(provider)} folder before saving.` });
        return;
      }
      if (!isSignedIn(provider)) {
        setStatus({ tone: "error", text: `Connect ${providerDisplayName(provider)} to continue.` });
        return;
      }
    }

    const finalFilename = assets.length === 1 && shouldPromptForRename ? filenameDraft.trim() || null : null;
    const results: BatchItemResult[] = [];
    const jobs = providers.flatMap((provider) => assets.map((asset) => ({ provider, asset })));
    setSaving(true);
    setStatus(null);
    for (const [index, job] of jobs.entries()) {
      setBatchProgress({ current: index + 1, total: jobs.length });
      try {
        const result = await sendBackgroundMessage<SaveResult>({
          type: "SAVE_PENDING",
          destinationPath: destinations[job.provider]!,
          provider: job.provider,
          candidate: job.asset,
          finalFilename,
        });
        results.push({ asset: job.asset, result });
      } catch (error) {
        results.push({
          asset: job.asset,
          result: {
            ok: false,
            status: "failed",
            message: error instanceof Error ? error.message : "The save request failed.",
          },
        });
      }
    }
    setBatchProgress(null);
    setSaving(false);

    const summary = summarizeBatch(results);
    const merged: BatchSummary = previous
      ? {
          total: previous.total,
          savedCount: previous.savedCount + summary.savedCount,
          failures: summary.failures,
          switchedToInstant: previous.switchedToInstant || summary.switchedToInstant,
          permissionOrigins: summary.permissionOrigins,
        }
      : {
          ...summary,
          total: jobs.length,
        };
    setBatchResult({ ...merged, destinations, providers });
    if (!merged.failures.length && !merged.switchedToInstant) {
      setTimeout(() => window.close(), SUCCESS_CLOSE_DELAY_MS);
    }
  }

  async function keepReviewing() {
    setKeepingReview(true);
    try {
      await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { savePreferences: { saveMode: "reviewed" } },
      });
      setKeptReviewing(true);
      setTimeout(() => window.close(), KEPT_REVIEWING_CLOSE_DELAY_MS);
    } catch {
      await openPreferencesTab();
    } finally {
      setKeepingReview(false);
    }
  }

  function renderSwitchedNotice(
    folderPath: string,
    provider: StorageProviderId,
    showDone: boolean,
    knownLabel?: string | null,
  ) {
    return (
      <div className="stack" style={{ width: "100%", textAlign: "left" }}>
        {keptReviewing ? (
          <StatusMessage tone="success">Got it. The review window will keep opening.</StatusMessage>
        ) : (
          <>
            <StatusMessage tone="info">
              From now on, saves go straight to{" "}
              <strong>{folderLabel(provider, folderPath, knownLabel)}</strong> without this window. You&apos;ll see a
              notice on the page when each one finishes.
            </StatusMessage>
            <div className="stack-sm" style={{ alignItems: "center" }}>
              {showDone ? <Button onClick={() => window.close()}>Done</Button> : null}
              <button
                className="link-button"
                disabled={keepingReview}
                onClick={() => void keepReviewing()}
                type="button"
              >
                {keepingReview ? "Saving…" : "Keep reviewing each save"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderFolderRows(providers: StorageProviderId[]) {
    return (
      <div className="stack">
        {providers.map((provider) => {
          const path = destinations[provider];
          return (
            <div className="row row-between" key={provider}>
              <div className="row" style={{ minWidth: 0 }}>
                <ProviderName className="muted" provider={provider} />
                <span className="path-pill" title={path || undefined}>
                  {folderLabel(provider, path, destinationLabels[provider])}
                </span>
              </div>
              {changingFolderFor !== provider ? (
                <Button disabled={saving} onClick={() => setChangingFolderFor(provider)} variant="ghost">
                  Change
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="app-shell save-shell">
        <div className="empty-state row" style={{ justifyContent: "center", border: 0 }}>
          <Spinner size="lg" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (savedTo) {
    const openUrl = getStorageProvider(savedTo.provider).getWebUrl(savedTo.folderPath);
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">
            Saved to {savedTo.folderLabel}
          </div>
          <div className="muted break-anywhere">{savedTo.filename}</div>
          <a href={openUrl} rel="noopener noreferrer" target="_blank">
            Open in {providerDisplayName(savedTo.provider)}
          </a>
          {savedTo.switchedToInstant
            ? renderSwitchedNotice(savedTo.folderPath, savedTo.provider, true, savedTo.folderLabel)
            : null}
        </section>
      </div>
    );
  }

  if (batchResult) {
    const allSaved = !batchResult.failures.length;
    const primaryProvider = batchResult.providers[0] ?? "dropbox";
    const primaryFolder = batchResult.destinations[primaryProvider];
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className={`badge ${allSaved ? "success" : "error"}`} style={{ fontSize: 20, padding: "8px 14px" }}>
            {allSaved ? "✓" : "!"}
          </span>
          <div className="section-title">
            {allSaved
              ? `Saved ${pluralizeFiles(batchResult.savedCount)}`
              : `Saved ${batchResult.savedCount} of ${pluralizeFiles(batchResult.total)}`}
          </div>
          <div className="stack-sm">
            {batchResult.providers.map((provider) => {
              const folder = batchResult.destinations[provider];
              if (!folder) return null;
              return (
                <a
                  href={getStorageProvider(provider).getWebUrl(folder)}
                  key={provider}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open in {providerDisplayName(provider)}
                </a>
              );
            })}
          </div>
          {!allSaved ? (
            <div className="stack" style={{ width: "100%", textAlign: "left" }}>
              <ul className="batch-failures">
                {batchResult.failures.map((failure) => (
                  <li key={`${failure.asset.sourceUrl}-${failure.message}`} title={failure.asset.sourceUrl}>
                    <strong className="break-anywhere">{failure.filename}</strong>
                    <span className="muted">{failure.message}</span>
                  </li>
                ))}
              </ul>
              {batchResult.permissionOrigins.length ? (
                <StatusMessage tone="info">
                  Some files are on sites Web Saver doesn&apos;t have access to yet:{" "}
                  <strong>{batchResult.permissionOrigins.map(getPatternHost).join(", ")}</strong>. Allow access to
                  download them from your browser.
                </StatusMessage>
              ) : null}
              {saving ? <div className="muted">Keep this window open until saving finishes.</div> : null}
              <div className="actions-wrap" style={{ justifyContent: "center" }}>
                <Button
                  loading={saving}
                  onClick={() =>
                    void (batchResult.permissionOrigins.length
                      ? allowAndRetryBatch(batchResult)
                      : saveBatch(batchResult.failures.map((failure) => failure.asset), batchResult))
                  }
                >
                  {batchProgress
                    ? `Saving ${batchProgress.current} of ${batchProgress.total}…`
                    : batchResult.permissionOrigins.length
                      ? "Allow access and retry"
                      : "Retry failed"}
                </Button>
                <Button disabled={saving} onClick={() => window.close()} variant="secondary">
                  Done
                </Button>
              </div>
            </div>
          ) : null}
          {batchResult.switchedToInstant && primaryFolder
            ? renderSwitchedNotice(
                primaryFolder,
                primaryProvider,
                allSaved,
                destinationLabels[primaryProvider],
              )
            : null}
        </section>
      </div>
    );
  }

  if (defaultSavedProvider && defaultFolders[defaultSavedProvider]) {
    const provider = defaultSavedProvider;
    const folder = defaultFolders[provider]!;
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">Default folder set</div>
          <span className="path-pill" title={folder}>
            {folderLabel(provider, folder, destinationLabels[provider])}
          </span>
          <div className="muted">
            New {providerDisplayName(provider)} saves go here. You can still pick a different folder while saving.
          </div>
          <div className="actions-wrap" style={{ justifyContent: "center" }}>
            <Button onClick={() => window.close()}>Done</Button>
            <Button onClick={() => setDefaultSavedProvider(null)} variant="secondary">
              Choose another folder
            </Button>
          </div>
          <a href={getStorageProvider(provider).getWebUrl(folder)} rel="noopener noreferrer" target="_blank">
            Open in {providerDisplayName(provider)}
          </a>
        </section>
      </div>
    );
  }

  const needsAuthProviders = activeProviders.filter((provider) => !isSignedIn(provider));
  const canSaveScan =
    selectedAssets.length > 0
    && selectedProviders.length > 0
    && selectedProviders.every((provider) => Boolean(destinations[provider]) && isSignedIn(provider));

  return (
    <div className="app-shell save-shell">
      <section className="hero">
        <div className="eyebrow">
          {saveFlow?.mode === "scan" ? "Pick files from this page" : saveFlow ? "Review save" : "Default folder"}
        </div>
        <h2>
          {saveFlow?.mode === "scan"
            ? "Choose the files and where to save them."
            : saveFlow
              ? `Check the name and ${providerDisplayName(singleProvider)} folder, then save.`
              : "Where should your saves go?"}
        </h2>
        {!saveFlow ? (
          <>
            <p>Open a folder below, then set it as the default. You can still pick another folder while saving.</p>
            <div className="stack-sm">
              {listStorageProviders().map((provider) => (
                <div className="row current-default" key={provider.id}>
                  <ProviderName className="muted" provider={provider.id} />
                  {defaultFolders[provider.id] ? (
                    <span className="path-pill" title={defaultFolders[provider.id] ?? undefined}>
                      {folderLabel(
                        provider.id,
                        defaultFolders[provider.id],
                        destinationLabels[provider.id],
                      )}
                    </span>
                  ) : (
                    <span className="badge neutral">Not set yet</span>
                  )}
                  <Button onClick={() => setChangingFolderFor(provider.id)} variant="ghost">
                    Set
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {status ? (
        <StatusMessage tone={status.tone}>
          {status.text}
          {status.tone === "error" ? (
            <>
              {" "}
              <button
                className="link-button"
                onClick={() => void openFeedbackTab({ kind: "bug", message: `Error shown: ${status.text}\n\n` })}
                type="button"
              >
                Report this problem
              </button>
            </>
          ) : null}
        </StatusMessage>
      ) : null}

      {needsAuthProviders.map((provider) => {
        const auth = authFor(provider);
        if (!auth) return null;
        return (
          <section className="panel stack" key={provider}>
            {provider === "dropbox" ? (
              <DropboxConnectCard
                authState={auth as DropboxAuthState}
                connecting={connectingProvider === "dropbox"}
                onConnect={() => void connect("dropbox")}
                onUseOwnApp={
                  auth.status === "missing_app_key" ? () => void openSettingsTab("setup") : undefined
                }
              />
            ) : (
              <GoogleDriveConnectCard
                authState={auth as GoogleDriveAuthState}
                connecting={connectingProvider === "google_drive"}
                onConnect={() => void connect("google_drive")}
              />
            )}
          </section>
        );
      })}

      {saveFlow?.mode === "scan" ? (
        <section className="panel stack">
          <div>
            <div className="section-title">Save to</div>
            <div className="muted">Choose Dropbox, Google Drive, or both.</div>
          </div>
          <div className="destination-grid">
            {listStorageProviders().map((provider) => {
              const selected = selectedProviders.includes(provider.id);
              const connected = isSignedIn(provider.id);
              return (
                <label
                  className={`destination-card${selected ? " selected" : ""}${connected ? "" : " disconnected"}`}
                  key={provider.id}
                >
                  <input
                    checked={selected}
                    disabled={saving}
                    onChange={() => toggleProvider(provider.id)}
                    type="checkbox"
                  />
                  <span className={`destination-mark ${provider.id === "dropbox" ? "dropbox" : "google-drive"}`}>
                    <ProviderMark provider={provider.id} size={20} />
                  </span>
                  <span className="destination-copy">
                    <strong>{provider.displayName}</strong>
                    <span className="muted truncate">
                      {connected
                        ? folderLabel(
                            provider.id,
                            destinations[provider.id],
                            destinationLabels[provider.id],
                          )
                        : "Not connected"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {saveFlow?.mode === "scan" ? (
        <section className="panel stack">
          <div className="row row-between">
            <div>
              <div className="section-title">Files on this page</div>
              <div className="muted">Tick the files you want to save.</div>
            </div>
            <span className="badge neutral">{saveFlow.assets.length} found</span>
          </div>
          <div className="asset-list-toolbar">
            <button className="link-button" disabled={saving || !visibleAssets.length} onClick={selectAllVisible} type="button">
              Select all
            </button>
            <button
              className="link-button"
              disabled={saving || !selectedUrls.size}
              onClick={() => setSelectedUrls(new Set())}
              type="button"
            >
              Clear
            </button>
            {smallImageCount ? (
              <label className="asset-toolbar-toggle">
                <input
                  checked={showSmallImages}
                  disabled={saving}
                  onChange={(event) => toggleSmallImages(event.target.checked)}
                  type="checkbox"
                />
                {`Show ${smallImageCount} small image${smallImageCount === 1 ? "" : "s"}`}
              </label>
            ) : null}
          </div>
          {visibleAssets.length ? (
            <div className="asset-list" style={{ marginTop: 0 }}>
              {visibleAssets.map((asset) => {
                const isSelected = selectedUrls.has(asset.sourceUrl);
                return (
                  <label
                    className={`asset-row${isSelected ? " selected" : ""}`}
                    key={asset.sourceUrl}
                    title={asset.sourceUrl}
                  >
                    <input
                      checked={isSelected}
                      disabled={saving}
                      onChange={() => toggleAsset(asset.sourceUrl)}
                      type="checkbox"
                    />
                    <AssetThumb asset={asset} />
                    <span className="asset-row-text">
                      <strong className="truncate">{deriveCandidateFilename(asset)}</strong>
                      <span className="muted truncate">{describeAsset(asset)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              {scanAssets.length
                ? "Only small images were found. Turn on “Show small images” to see them."
                : "No files were found on this page."}
            </div>
          )}
        </section>
      ) : null}

      {saveFlow?.mode === "scan" ? (
        <section className="panel stack">
          <div className="section-title">
            {selectedAssets.length ? `${pluralizeFiles(selectedAssets.length)} selected` : "Select files to save"}
          </div>
          {shouldPromptForRename && selectedAssets.length === 1 ? (
            <label className="field">
              <span className="field-label">File name</span>
              <input
                className="text-input"
                disabled={saving}
                onChange={(event) => setFilenameDraft(event.target.value)}
                value={filenameDraft}
              />
            </label>
          ) : shouldPromptForRename && selectedAssets.length > 1 ? (
            <div className="muted">Select a single file to rename it.</div>
          ) : null}
          {renderFolderRows(selectedProviders)}
          <Button
            block
            disabled={!canSaveScan}
            large
            loading={saving}
            onClick={() => void saveBatch(selectedAssets)}
          >
            {batchProgress
              ? `Saving ${batchProgress.current} of ${batchProgress.total}…`
              : selectedAssets.length
                ? `Save ${pluralizeFiles(selectedAssets.length)}`
                : "Save files"}
          </Button>
          {saving ? <div className="muted">Keep this window open until saving finishes.</div> : null}
        </section>
      ) : null}

      {saveFlow?.mode === "single" && reviewCandidate ? (
        <section className="panel stack">
          <div className="row row-between">
            <div className="section-title">Ready to save</div>
            <span className="badge neutral">
              {reviewCandidate.triggerKind === "linked_file" ? "File from link" : "Media asset"}
              {" · "}
              {providerDisplayName(singleProvider)}
            </span>
          </div>
          {shouldPromptForRename ? (
            <label className="field">
              <span className="field-label">File name</span>
              <input
                className="text-input"
                onChange={(event) => setFilenameDraft(event.target.value)}
                value={filenameDraft}
              />
            </label>
          ) : resolvedFilename ? (
            <div className="field">
              <span className="field-label">File name</span>
              <strong className="break-anywhere">{resolvedFilename}</strong>
            </div>
          ) : null}
          <div className="muted truncate" title={reviewCandidate.sourceUrl}>
            From {reviewCandidate.sourceUrl}
          </div>
          {renderFolderRows([singleProvider])}
          {permissionOrigins.length ? (
            <StatusMessage tone="info">
              {providerDisplayName(singleProvider)} couldn&apos;t fetch this file by itself, so Web Saver needs to
              download it from your browser. Allow access to{" "}
              <strong>{permissionOrigins.map(getPatternHost).join(", ")}</strong> to continue. Chrome remembers your
              choice for that site.
            </StatusMessage>
          ) : null}
          <Button
            block
            disabled={!destinations[singleProvider] || !isSignedIn(singleProvider)}
            large
            loading={saving}
            onClick={() => void (permissionOrigins.length ? allowAndSave() : completeSave())}
          >
            {saving
              ? "Saving…"
              : permissionOrigins.length
                ? "Allow access and save"
                : `Save to ${providerDisplayName(singleProvider)}`}
          </Button>
        </section>
      ) : null}

      {changingFolderFor && isSignedIn(changingFolderFor) && (saveFlow || !defaultSavedProvider) ? (
        <FolderPicker
          confirmLabel={saveFlow ? "Use this folder" : "Set as default folder"}
          confirming={!saveFlow && saving}
          defaultPath={defaultFolders[changingFolderFor]}
          initialPath={
            destinations[changingFolderFor]
            || getStorageProvider(changingFolderFor).getRootFolderKey()
          }
          onCancel={saveFlow ? () => setChangingFolderFor(null) : undefined}
          onConfirm={(path, label) => {
            if (!saveFlow) {
              void saveDefaultFolder(changingFolderFor, path, label);
              return;
            }
            const provider = changingFolderFor;
            setDestinations((current) => ({ ...current, [provider]: path }));
            setDestinationLabels((current) => ({ ...current, [provider]: label }));
            setChangingFolderFor(null);
            setSaveFlow((current) => {
              if (current?.mode === "single") {
                return {
                  ...current,
                  request: {
                    ...current.request,
                    destinationPath: path,
                    forceFolderPicker: false,
                  },
                };
              }
              if (current?.mode === "scan") {
                return {
                  ...current,
                  destinations: {
                    dropbox: current.destinations?.dropbox ?? null,
                    google_drive: current.destinations?.google_drive ?? null,
                    [provider]: path,
                  },
                };
              }
              return current;
            });
            void sendBackgroundMessage<ExtensionSettings>({
              type: "SET_LAST_USED_FOLDER",
              path,
              provider,
              label,
            });
          }}
          provider={changingFolderFor}
        />
      ) : null}

      <footer className="page-footer">
        <button className="link-button" onClick={() => void openPreferencesTab()} type="button">
          Change how saving works
        </button>
        <span className="muted">{" · "}</span>
        <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
        <span className="muted">{" · "}</span>
        <button className="link-button" onClick={() => void openFeedbackTab()} type="button">
          Send feedback
        </button>
      </footer>
    </div>
  );
}
