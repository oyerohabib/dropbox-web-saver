import { useEffect, useState } from "react";
import { FolderPicker } from "../../components/FolderPicker";
import { sendBackgroundMessage } from "../../lib/browser";
import { deriveCandidateFilename } from "../../lib/utils/filename";
import type {
  AssetCandidate,
  DropboxAuthState,
  ExtensionSettings,
  PendingSaveState,
  SavePreferences,
  SaveResult,
} from "../../lib/types";

function getReviewCandidate(flow: PendingSaveState | null, selectedSourceUrl: string | null): AssetCandidate | null {
  if (!flow) return null;
  if (flow.mode === "single") return flow.request.candidate;
  return flow.assets.find((asset) => asset.sourceUrl === selectedSourceUrl) || flow.assets[0] || null;
}

export function SaveApp() {
  const [authState, setAuthState] = useState<DropboxAuthState | null>(null);
  const [saveFlow, setSaveFlow] = useState<PendingSaveState | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>("/");
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string | null>(null);
  const [filenameDraft, setFilenameDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingFolder, setChangingFolder] = useState(false);
  const [savePreferences, setSavePreferences] = useState<SavePreferences | null>(null);

  async function load() {
    const [nextAuthState, nextSaveFlow, settings] = await Promise.all([
      sendBackgroundMessage<DropboxAuthState>({ type: "GET_AUTH_STATE" }),
      sendBackgroundMessage<PendingSaveState | null>({ type: "GET_PENDING_SAVE" }),
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ]);
    setAuthState(nextAuthState);
    setSaveFlow(nextSaveFlow);
    setSavePreferences(settings.savePreferences);
    setSelectedPath(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.destinationPath || settings.lastUsedFolderPath || "/"
        : nextSaveFlow?.request.destinationPath || settings.lastUsedFolderPath || "/",
    );
    setSelectedSourceUrl(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.selectedSourceUrl || nextSaveFlow.assets[0]?.sourceUrl || null
        : nextSaveFlow?.request.candidate.sourceUrl || null,
    );
    const nextCandidate =
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.assets.find((asset) => asset.sourceUrl === nextSaveFlow.selectedSourceUrl)
          || nextSaveFlow.assets[0]
        : nextSaveFlow?.request.candidate;
    const nextResolvedFilename = nextCandidate
      ? deriveCandidateFilename(
          nextCandidate,
          nextSaveFlow?.mode === "single" ? nextSaveFlow.request.finalFilename : null,
        )
      : "";
    setFilenameDraft(
      nextSaveFlow?.mode === "scan"
        ? nextSaveFlow.selectedFilename || nextResolvedFilename
        : nextSaveFlow?.mode === "single"
          ? nextSaveFlow.request.finalFilename || nextSaveFlow.resolvedFilename || nextResolvedFilename
          : nextResolvedFilename,
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
    void load();
  }, []);

  const reviewCandidate = getReviewCandidate(saveFlow, selectedSourceUrl);
  const resolvedFilename = reviewCandidate ? deriveCandidateFilename(reviewCandidate) : null;
  const shouldPromptForRename = savePreferences?.promptForRename ?? false;

  useEffect(() => {
    if (saveFlow?.mode === "scan" && resolvedFilename) {
      setFilenameDraft(resolvedFilename);
    }
  }, [resolvedFilename, saveFlow?.mode, selectedSourceUrl]);

  async function connect() {
    try {
      await sendBackgroundMessage<DropboxAuthState>({ type: "CONNECT_DROPBOX" });
      setStatusMessage("Dropbox connected.");
      await load();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Dropbox connection failed.");
    }
  }

  async function completeSave() {
    if (!selectedPath) return;
    try {
      if (!saveFlow) {
        await sendBackgroundMessage<ExtensionSettings>({
          type: "SET_LAST_USED_FOLDER",
          path: selectedPath,
        });
        setStatusMessage(`Default Dropbox folder set to ${selectedPath}.`);
        setChangingFolder(false);
        return;
      }

      if (!reviewCandidate) {
        setStatusMessage("No asset is selected for saving.");
        return;
      }

      setSaving(true);
      const result = await sendBackgroundMessage<SaveResult>({
        type: "SAVE_PENDING",
        destinationPath: selectedPath,
        candidate: saveFlow.mode === "scan" ? reviewCandidate : undefined,
        finalFilename: filenameDraft.trim() || resolvedFilename,
      });
      setStatusMessage(result.message);
      if (result.ok) {
        window.close();
      } else {
        await load();
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The save request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <section className="hero">
        <div className="eyebrow">
          {saveFlow?.mode === "scan" ? "Scan Flow" : saveFlow ? "Save Review" : "Folder Preference"}
        </div>
        <h2>
          {saveFlow?.mode === "scan"
            ? "Browse assets from this page, choose one, and save it to Dropbox."
            : saveFlow
              ? "Review the filename and folder before the asset is saved."
              : "Choose the default Dropbox folder for future saves."}
        </h2>
        <p>
          {reviewCandidate?.sourceUrl
            || "Open this window from the extension to review a save or choose a default folder."}
        </p>
      </section>

      {statusMessage ? <div className="callout info">{statusMessage}</div> : null}

      {authState?.status !== "signed_in" ? (
        <section className="panel stack">
          <div className="section-title">Connect Dropbox</div>
          <div className="muted">
            {authState?.status === "missing_app_key"
              ? "Add your Dropbox app key on the settings page before you connect."
              : "Authorize Dropbox to continue."}
          </div>
          <div className="actions-wrap">
            <button
              className="primary-button"
              disabled={authState?.status === "missing_app_key"}
              onClick={() => void connect()}
              type="button"
            >
              Connect Dropbox
            </button>
            <button
              className="secondary-button"
              onClick={() => chrome.runtime.openOptionsPage()}
              type="button"
            >
              Open Settings
            </button>
          </div>
        </section>
      ) : null}

      {saveFlow?.mode === "scan" ? (
        <section className="panel stack">
          <div className="row row-between">
            <div>
              <div className="section-title">Detected Page Assets</div>
              <div className="muted">
                Choose the file you want to review and save.
              </div>
            </div>
            <div className="muted">{saveFlow.assets.length} found</div>
          </div>
          <div className="asset-list">
            {saveFlow.assets.map((asset) => {
              const assetFilename = deriveCandidateFilename(asset);
              return (
                <button
                  className="asset-row"
                  key={asset.sourceUrl}
                  onClick={() => setSelectedSourceUrl(asset.sourceUrl)}
                  type="button"
                >
                  <div className="row row-between">
                    <strong>{assetFilename}</strong>
                    {selectedSourceUrl === asset.sourceUrl ? <span className="badge success">Selected</span> : null}
                  </div>
                  <span className="muted">{asset.sourceUrl}</span>
                  <span className="muted">
                    {asset.detectedType}
                    {asset.requiresAuthenticatedFetch ? " • authenticated fetch" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {reviewCandidate ? (
        <section className="panel stack">
          <div className="row row-between">
            <div>
              <div className="section-title">Ready To Save</div>
              <div className="muted">{reviewCandidate.triggerKind === "linked_file" ? "Linked file" : "Media asset"}</div>
            </div>
            {resolvedFilename ? <span className="path-pill">{resolvedFilename}</span> : null}
          </div>
          <div className="muted">{reviewCandidate.sourceUrl}</div>
          {reviewCandidate.elementTextHint ? (
            <div className="muted">Hint: {reviewCandidate.elementTextHint}</div>
          ) : null}
          {shouldPromptForRename ? (
            <label className="stack">
              <span className="muted">Filename before upload</span>
              <input
                className="text-input"
                onChange={(event) => setFilenameDraft(event.target.value)}
                value={filenameDraft}
              />
            </label>
          ) : null}
          <div className="row row-between">
            <div className="muted">Folder: {selectedPath || "/"}</div>
            <button
              className="ghost-button"
              onClick={() => setChangingFolder((current) => !current)}
              type="button"
            >
              {changingFolder ? "Hide Folder Picker" : "Change Folder"}
            </button>
          </div>
          <button
            className="primary-button"
            disabled={!selectedPath || saving}
            onClick={() => void completeSave()}
            type="button"
          >
            {saving ? "Saving..." : "Save to Dropbox"}
          </button>
        </section>
      ) : null}

      {(!saveFlow || changingFolder || !reviewCandidate) ? (
        <FolderPicker
          initialPath={selectedPath || "/"}
          onSelect={(path) => {
            setSelectedPath(path);
            setChangingFolder(false);
          }}
          selectedPath={selectedPath}
        />
      ) : null}

      {!saveFlow ? (
        <section className="panel stack">
          <div className="row row-between">
            <div>
              <div className="section-title">Remember Folder</div>
              <div className="muted">Selected folder: {selectedPath || "None"}</div>
            </div>
            <button
              className="primary-button"
              disabled={!selectedPath || saving}
              onClick={() => void completeSave()}
              type="button"
            >
              Remember Folder
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
