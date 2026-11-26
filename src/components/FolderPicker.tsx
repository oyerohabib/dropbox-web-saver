import { Fragment, useEffect, useState } from "react";
import type { FolderEntry, StorageProviderId } from "../lib/types";
import { sendBackgroundMessage } from "../lib/browser";
import { getStorageProvider } from "../lib/providers";
import {
  formatFolderPath,
  getBreadcrumbs,
  getFolderName,
  getParentPath,
  isSameFolder,
  type FolderCrumb,
} from "../lib/utils/folder-path";
import { Button, Skeleton, StatusMessage } from "./ui";

interface FolderPickerProps {
  provider?: StorageProviderId;
  initialPath: string;
  confirmLabel: string;
  onConfirm: (path: string, label: string) => void;
  onCancel?: () => void;
  defaultPath?: string | null;
  confirming?: boolean;
}

export function FolderPicker({
  provider = "dropbox",
  initialPath,
  confirmLabel,
  onConfirm,
  onCancel,
  defaultPath,
  confirming = false,
}: FolderPickerProps) {
  const storageProvider = getStorageProvider(provider);
  const rootKey = storageProvider.getRootFolderKey();
  const [currentPath, setCurrentPath] = useState(initialPath || rootKey);
  const [trail, setTrail] = useState<FolderCrumb[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadFolders(path: string, nextTrail: FolderCrumb[] = trail) {
    setLoading(true);
    setError(null);
    try {
      const entries = await sendBackgroundMessage<FolderEntry[]>({
        type: "LIST_FOLDERS",
        path,
        provider,
      });
      setFolders(entries);
      setCurrentPath(path);
      if (provider === "google_drive") {
        if (path !== rootKey && nextTrail.length === 0) {
          const name = await sendBackgroundMessage<string>({
            type: "RESOLVE_FOLDER_LABEL",
            path,
            provider,
          });
          setTrail([{ label: name, path }]);
        } else {
          setTrail(nextTrail);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load folders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFolders(initialPath || rootKey, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when provider/path change
  }, [initialPath, provider, rootKey]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const createdPath = await sendBackgroundMessage<string>({
        type: "CREATE_FOLDER",
        parentPath: currentPath,
        name,
        provider,
      });
      setNewFolderName("");
      setShowCreate(false);
      const createdTrail =
        provider === "google_drive"
          ? [...trail, { label: name, path: createdPath }]
          : trail;
      await loadFolders(createdPath, createdTrail);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  function openFolder(folder: FolderEntry) {
    if (provider === "google_drive") {
      void loadFolders(folder.id, [...trail, { label: folder.name, path: folder.id }]);
      return;
    }
    void loadFolders(folder.pathDisplay);
  }

  function openCrumb(crumb: FolderCrumb) {
    if (provider === "google_drive") {
      const index = trail.findIndex((item) => item.path === crumb.path);
      const nextTrail = crumb.path === rootKey ? [] : trail.slice(0, index + 1);
      void loadFolders(crumb.path, nextTrail);
      return;
    }
    void loadFolders(crumb.path);
  }

  function goUp() {
    if (provider === "google_drive") {
      if (trail.length === 0) return;
      const nextTrail = trail.slice(0, -1);
      const parent = nextTrail.at(-1)?.path ?? rootKey;
      void loadFolders(parent, nextTrail);
      return;
    }
    void loadFolders(getParentPath(currentPath));
  }

  const crumbs = getBreadcrumbs(currentPath, provider, trail);
  const currentName =
    provider === "google_drive"
      ? trail.at(-1)?.label ?? getFolderName(currentPath, provider)
      : getFolderName(currentPath, provider);
  const isRoot = currentPath === rootKey;
  const sameFolder = (a: string | null | undefined, b: string | null | undefined) =>
    provider === "google_drive" ? Boolean(a && b && a === b) : isSameFolder(a, b);
  const selectedLabel =
    provider === "google_drive"
      ? storageProvider.formatFolderLabel(currentPath, trail.at(-1)?.label)
      : formatFolderPath(currentPath, provider);

  return (
    <div className="panel stack folder-picker">
      <div className="row row-between folder-picker-header">
        <nav aria-label="Folder path" className="breadcrumbs">
          {crumbs.map((crumb, index) =>
            index === crumbs.length - 1 ? (
              <span aria-current="location" className="crumb current" key={crumb.path} title={crumb.path}>
                {crumb.label}
              </span>
            ) : (
              <Fragment key={crumb.path}>
                <button
                  className="crumb"
                  disabled={loading}
                  onClick={() => openCrumb(crumb)}
                  title={crumb.path}
                  type="button"
                >
                  {crumb.label}
                </button>
                <span aria-hidden="true" className="crumb-sep">›</span>
              </Fragment>
            ),
          )}
        </nav>
        {!showCreate ? (
          <Button onClick={() => setShowCreate(true)} variant="ghost">
            + New folder
          </Button>
        ) : null}
      </div>

      {showCreate ? (
        <form
          className="create-folder"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowCreate(false);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void createFolder();
          }}
        >
          <input
            aria-label="New folder name"
            autoFocus
            className="text-input"
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder={`New folder in ${currentName}`}
            value={newFolderName}
          />
          <Button disabled={!newFolderName.trim()} loading={creating} type="submit">
            Create
          </Button>
          <Button onClick={() => setShowCreate(false)} variant="ghost">
            Cancel
          </Button>
        </form>
      ) : null}

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="folder-list">
        {loading ? <Skeleton rows={4} /> : null}
        {!loading && !isRoot ? (
          <button className="folder-row folder-up" onClick={goUp} type="button">
            <span className="folder-row-main">
              <span aria-hidden="true">↑</span>
              <span className="truncate">
                Up to{" "}
                {provider === "google_drive"
                  ? trail.at(-2)?.label ?? getFolderName(rootKey, provider)
                  : getFolderName(getParentPath(currentPath), provider)}
              </span>
            </span>
          </button>
        ) : null}
        {!loading && folders.length === 0 ? (
          <div className="empty-state">
            <strong>{currentName}</strong> has no folders inside.
            <br />
            Use it as it is, or create a new folder.
          </div>
        ) : null}
        {!loading
          ? folders.map((folder) => (
              <button
                className="folder-row"
                key={folder.id}
                onClick={() => openFolder(folder)}
                title={`Open ${folder.name}`}
                type="button"
              >
                <span className="folder-row-main">
                  <span aria-hidden="true">📁</span>
                  <span className="truncate">{folder.name}</span>
                  {sameFolder(
                    provider === "google_drive" ? folder.id : folder.pathDisplay,
                    defaultPath,
                  ) ? (
                    <span className="badge accent">Default</span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="muted">›</span>
              </button>
            ))
          : null}
      </div>

      <div className="folder-confirm">
        <div className="stack-sm" style={{ minWidth: 0 }}>
          <span className="muted">Selected folder</span>
          <span className="row" style={{ minWidth: 0 }}>
            <span className="path-pill" title={currentPath}>{selectedLabel}</span>
            {sameFolder(currentPath, defaultPath) ? <span className="badge accent">Default</span> : null}
          </span>
        </div>
        <div className="row">
          {onCancel ? (
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
          ) : null}
          <Button disabled={loading} loading={confirming} onClick={() => onConfirm(currentPath, selectedLabel)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
