import { Fragment, useEffect, useState } from "react";
import type { FolderEntry } from "../lib/types";
import { sendBackgroundMessage } from "../lib/browser";
import { formatFolderPath, getBreadcrumbs, getFolderName, getParentPath, isSameFolder } from "../lib/utils/folder-path";
import { Button, Skeleton, StatusMessage } from "./ui";

interface FolderPickerProps {
  initialPath: string;
  confirmLabel: string;
  onConfirm: (path: string) => void;
  onCancel?: () => void;
  defaultPath?: string | null;
  confirming?: boolean;
}

export function FolderPicker({
  initialPath,
  confirmLabel,
  onConfirm,
  onCancel,
  defaultPath,
  confirming = false,
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "/");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadFolders(path: string) {
    setLoading(true);
    setError(null);
    try {
      const entries = await sendBackgroundMessage<FolderEntry[]>({
        type: "LIST_FOLDERS",
        path,
      });
      setFolders(entries);
      setCurrentPath(path);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load folders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFolders(initialPath || "/");
  }, [initialPath]);

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
      });
      setNewFolderName("");
      setShowCreate(false);
      await loadFolders(createdPath);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  const crumbs = getBreadcrumbs(currentPath);
  const currentName = getFolderName(currentPath);
  const isRoot = currentPath === "/";

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
                  onClick={() => void loadFolders(crumb.path)}
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
          <button className="folder-row folder-up" onClick={() => void loadFolders(getParentPath(currentPath))} type="button">
            <span className="folder-row-main">
              <span aria-hidden="true">↑</span>
              <span className="truncate">Up to {getFolderName(getParentPath(currentPath))}</span>
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
                onClick={() => void loadFolders(folder.pathDisplay)}
                title={`Open ${folder.pathDisplay}`}
                type="button"
              >
                <span className="folder-row-main">
                  <span aria-hidden="true">📁</span>
                  <span className="truncate">{folder.name}</span>
                  {isSameFolder(folder.pathDisplay, defaultPath) ? <span className="badge accent">Default</span> : null}
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
            <span className="path-pill" title={currentPath}>{formatFolderPath(currentPath)}</span>
            {isSameFolder(currentPath, defaultPath) ? <span className="badge accent">Default</span> : null}
          </span>
        </div>
        <div className="row">
          {onCancel ? (
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
          ) : null}
          <Button disabled={loading} loading={confirming} onClick={() => onConfirm(currentPath)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
