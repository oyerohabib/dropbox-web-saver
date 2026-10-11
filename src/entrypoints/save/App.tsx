import { useEffect, useState } from "react";
import { FolderPicker } from "../../components/FolderPicker";
import { Button, Spinner, StatusMessage, type StatusTone } from "../../components/ui";
import { openFeedbackTab, openPreferencesTab, openSettingsTab, sendBackgroundMessage } from "../../lib/browser";
import { isSmallAsset } from "../../lib/utils/asset";
import { summarizeBatch, type BatchItemResult, type BatchSummary } from "../../lib/utils/batch";
import { deriveCandidateFilename } from "../../lib/utils/filename";
import { formatFolderPath } from "../../lib/utils/folder-path";
import { getDomain, getDropboxWebUrl } from "../../lib/utils/url";
import type {
  AssetCandidate,
  DropboxAuthState,
  ExtensionSettings,
  PendingSaveState,
  SavePreferences,
  SaveResult,
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

export function SaveApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [saveFlow, setSaveFlow] = useState<PendingSaveState | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>("/");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set());
  const [showSmallImages, setShowSmallImages] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResult, setBatchResult] = useState<(BatchSummary & { folderPath: string }) | null>(null);
  const [filenameDraft, setFilenameDraft] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTo, setSavedTo] = useState<{ folderPath: string; filename: string; switchedToInstant: boolean } | null>(
    null,
  );
  const [keptReviewing, setKeptReviewing] = useState(false);
  const [keepingReview, setKeepingReview] = useState(false);
  const [changingFolder, setChangingFolder] = useState(false);
  const [savePreferences, setSavePreferences] = useState<SavePreferences | null>(null);
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);

  async function load() {
    const [nextAuthState, nextSaveFlow, settings] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<PendingSaveState | null>({ type: "GET_PENDING_SAVE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ]);
    setAuthState(nextAuthState);
    setSaveFlow(nextSaveFlow);
    setSavePreferences(settings.savePreferences);
    setDefaultFolder(settings.lastUsedFolderPath);
    setSelectedPath(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.destinationPath || settings.lastUsedFolderPath || "/"
        : nextSaveFlow?.request.destinationPath || settings.lastUsedFolderPath || "/",
    );
    setFilenameDraft(
      nextSaveFlow?.mode === "single"
        ? nextSaveFlow.request.finalFilename
          || nextSaveFlow.resolvedFilename
          || deriveCandidateFilename(nextSaveFlow.request.candidate, nextSaveFlow.request.finalFilename)
        : "",
    );
    setChangingFolder(
      Boolean(
        settings.savePreferences.folderBehavior === "always_ask"
          || (nextSaveFlow?.mode === "single" && nextSaveFlow.request.forceFolderPicker)
          || (!settings.lastUsedFolderPath
            && !(nextSaveFlow && nextSaveFlow.mode === "single" && nextSaveFlow.request.destinationPath)),
      ),
    );
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

  async function connect() {
    setConnecting(true);
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      setStatus({ tone: "success", text: "Dropbox connected." });
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Dropbox connection failed." });
    } finally {
      setConnecting(false);
    }
  }

  async function saveDefaultFolder(path: string) {
    setSaving(true);
    setStatus(null);
    try {
      await sendBackgroundMessage<ExtensionSettings>({ type: "SET_LAST_USED_FOLDER", path });
      setSelectedPath(path);
      setDefaultFolder(path);
      setDefaultSaved(true);
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not save the default folder." });
    } finally {
      setSaving(false);
    }
  }

  async function completeSave() {
    if (!selectedPath || !saveFlow) return;
    try {
      if (!reviewCandidate) {
        setStatus({ tone: "error", text: "No file is selected for saving." });
        return;
      }

      setSaving(true);
      const result = await sendBackgroundMessage<SaveResult>({
        type: "SAVE_PENDING",
        destinationPath: selectedPath,
        finalFilename: filenameDraft.trim() || resolvedFilename,
      });
      if (result.ok) {
        const switchedToInstant = Boolean(result.switchedToInstant);
        setSavedTo({ folderPath: selectedPath, filename: result.filename ?? filenameDraft, switchedToInstant });
        if (!switchedToInstant) {
          setTimeout(() => window.close(), SUCCESS_CLOSE_DELAY_MS);
        }
      } else {
        setStatus({ tone: "error", text: result.message });
        await load();
      }
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "The save request failed." });
    } finally {
      setSaving(false);
    }
  }

  async function saveBatch(assets: AssetCandidate[], previous?: BatchSummary) {
    if (!selectedPath || !assets.length) return;
    const folderPath = selectedPath;
    const finalFilename = assets.length === 1 && shouldPromptForRename ? filenameDraft.trim() || null : null;
    const results: BatchItemResult[] = [];
    setSaving(true);
    setStatus(null);
    for (const [index, asset] of assets.entries()) {
      setBatchProgress({ current: index + 1, total: assets.length });
      try {
        const result = await sendBackgroundMessage<SaveResult>({
          type: "SAVE_PENDING",
          destinationPath: folderPath,
          candidate: asset,
          finalFilename,
        });
        results.push({ asset, result });
      } catch (error) {
        results.push({
          asset,
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
        }
      : summary;
    setBatchResult({ ...merged, folderPath });
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

  function renderSwitchedNotice(folderPath: string, showDone: boolean) {
    return (
      <div className="stack" style={{ width: "100%", textAlign: "left" }}>
        {keptReviewing ? (
          <StatusMessage tone="success">Got it. The review window will keep opening.</StatusMessage>
        ) : (
          <>
            <StatusMessage tone="info">
              From now on, saves go straight to <strong>{formatFolderPath(folderPath)}</strong> without
              this window. You&apos;ll see a notice on the page when each one finishes.
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
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">Saved to {formatFolderPath(savedTo.folderPath)}</div>
          <div className="muted break-anywhere">{savedTo.filename}</div>
          <a href={getDropboxWebUrl(savedTo.folderPath)} rel="noopener noreferrer" target="_blank">
            Open in Dropbox
          </a>
          {savedTo.switchedToInstant ? renderSwitchedNotice(savedTo.folderPath, true) : null}
        </section>
      </div>
    );
  }

  if (batchResult) {
    const allSaved = !batchResult.failures.length;
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className={`badge ${allSaved ? "success" : "error"}`} style={{ fontSize: 20, padding: "8px 14px" }}>
            {allSaved ? "✓" : "!"}
          </span>
          <div className="section-title">
            {allSaved
              ? `Saved ${pluralizeFiles(batchResult.savedCount)} to ${formatFolderPath(batchResult.folderPath)}`
              : `Saved ${batchResult.savedCount} of ${pluralizeFiles(batchResult.total)}`}
          </div>
          {!allSaved ? <div className="muted">Folder: {formatFolderPath(batchResult.folderPath)}</div> : null}
          {batchResult.savedCount ? (
            <a href={getDropboxWebUrl(batchResult.folderPath)} rel="noopener noreferrer" target="_blank">
              Open in Dropbox
            </a>
          ) : null}
          {!allSaved ? (
            <div className="stack" style={{ width: "100%", textAlign: "left" }}>
              <ul className="batch-failures">
                {batchResult.failures.map((failure) => (
                  <li key={failure.asset.sourceUrl} title={failure.asset.sourceUrl}>
                    <strong className="break-anywhere">{failure.filename}</strong>
                    <span className="muted">{failure.message}</span>
                  </li>
                ))}
              </ul>
              {saving ? <div className="muted">Keep this window open until saving finishes.</div> : null}
              <div className="actions-wrap" style={{ justifyContent: "center" }}>
                <Button
                  loading={saving}
                  onClick={() => void saveBatch(batchResult.failures.map((failure) => failure.asset), batchResult)}
                >
                  {batchProgress ? `Saving ${batchProgress.current} of ${batchProgress.total}…` : "Retry failed"}
                </Button>
                <Button disabled={saving} onClick={() => window.close()} variant="secondary">
                  Done
                </Button>
              </div>
            </div>
          ) : null}
          {batchResult.switchedToInstant ? renderSwitchedNotice(batchResult.folderPath, allSaved) : null}
        </section>
      </div>
    );
  }

  if (defaultSaved && defaultFolder) {
    return (
      <div className="app-shell save-shell">
        <section className="panel stack" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
          <span className="badge success" style={{ fontSize: 20, padding: "8px 14px" }}>✓</span>
          <div className="section-title">Default folder set</div>
          <span className="path-pill" title={defaultFolder}>{formatFolderPath(defaultFolder)}</span>
          <div className="muted">
            New saves go here. You can still pick a different folder while saving.
          </div>
          <div className="actions-wrap" style={{ justifyContent: "center" }}>
            <Button onClick={() => window.close()}>Done</Button>
            <Button onClick={() => setDefaultSaved(false)} variant="secondary">
              Choose another folder
            </Button>
          </div>
          <a href={getDropboxWebUrl(defaultFolder)} rel="noopener noreferrer" target="_blank">
            Open in Dropbox
          </a>
        </section>
      </div>
    );
  }

  const folderRow = (
    <div className="row row-between">
      <div className="row" style={{ minWidth: 0 }}>
        <span className="muted">Folder</span>
        <span className="path-pill" title={selectedPath || "/"}>{formatFolderPath(selectedPath || "/")}</span>
      </div>
      {!changingFolder ? (
        <Button disabled={saving} onClick={() => setChangingFolder(true)} variant="ghost">
          Change
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="app-shell save-shell">
      <section className="hero">
        <div className="eyebrow">
          {saveFlow?.mode === "scan" ? "Pick files from this page" : saveFlow ? "Review save" : "Default folder"}
        </div>
        <h2>
          {saveFlow?.mode === "scan"
            ? "Choose the files you want to save to Dropbox."
            : saveFlow
              ? "Check the name and folder, then save."
              : "Where should your saves go?"}
        </h2>
        {!saveFlow ? (
          <>
            <p>Open a folder below, then set it as the default. You can still pick another folder while saving.</p>
            <div className="row current-default">
              <span className="muted">Current default</span>
              {defaultFolder ? (
                <span className="path-pill" title={defaultFolder}>{formatFolderPath(defaultFolder)}</span>
              ) : (
                <span className="badge neutral">Not set yet</span>
              )}
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

      {authState?.status !== "signed_in" ? (
        <section className="panel stack">
          <div className="section-title">Connect Dropbox</div>
          <div className="muted">
            {authState?.status === "missing_app_key"
              ? "Web Saver needs a Dropbox app key first. The setup guide walks you through it in about 3 minutes."
              : "Authorize Dropbox to continue."}
          </div>
          <div className="actions-wrap">
            {authState?.status === "missing_app_key" ? (
              <Button onClick={() => void openSettingsTab("setup")}>Open setup guide</Button>
            ) : (
              <>
                <Button loading={connecting} onClick={() => void connect()}>
                  Connect Dropbox
                </Button>
                <Button onClick={() => void openSettingsTab("setup")} variant="secondary">
                  Setup help
                </Button>
              </>
            )}
          </div>
          <div className="muted">
            🔒 Your key stays on this computer.{" "}
            <a href="/privacy.html" rel="noopener" target="_blank">Privacy policy</a>
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
                Show {smallImageCount} small image{smallImageCount === 1 ? "" : "s"}
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
          {folderRow}
          <Button
            block
            disabled={!selectedPath || !selectedAssets.length}
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
          {folderRow}
          <Button
            block
            disabled={!selectedPath}
            large
            loading={saving}
            onClick={() => void completeSave()}
          >
            {saving ? "Saving…" : "Save to Dropbox"}
          </Button>
        </section>
      ) : null}

      {authState?.status === "signed_in" && (!saveFlow || changingFolder) ? (
        <FolderPicker
          confirmLabel={saveFlow ? "Use this folder" : "Set as default folder"}
          confirming={!saveFlow && saving}
          defaultPath={defaultFolder}
          initialPath={selectedPath || "/"}
          onCancel={saveFlow ? () => setChangingFolder(false) : undefined}
          onConfirm={(path) => {
            if (!saveFlow) {
              void saveDefaultFolder(path);
              return;
            }
            setSelectedPath(path);
            setChangingFolder(false);
          }}
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
