import { useEffect, useState } from "react";
import type { FolderEntry } from "../lib/types";
import { sendBackgroundMessage } from "../lib/browser";
import { Button, Skeleton, StatusMessage } from "./ui";

interface FolderPickerProps {
  initialPath: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function getParentPath(path: string): string {
  if (path === "/") return "/";
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

export function FolderPicker({ initialPath, selectedPath, onSelect }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "/");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      onSelect(createdPath);
      await loadFolders(currentPath);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="panel">
      <div className="row row-between">
        <div className="stack-sm" style={{ minWidth: 0 }}>
          <div className="eyebrow">Dropbox folder</div>
          <div className="path-pill" title={currentPath}>{currentPath}</div>
        </div>
        <Button
          disabled={currentPath === "/" || loading}
          onClick={() => void loadFolders(getParentPath(currentPath))}
          variant="ghost"
        >
          ↑ Up
        </Button>
      </div>

      <div className="folder-actions">
        <Button block onClick={() => onSelect(currentPath)}>
          {selectedPath === currentPath ? "✓ Using this folder" : "Use this folder"}
        </Button>
      </div>

      <form
        className="create-folder"
        onSubmit={(event) => {
          event.preventDefault();
          void createFolder();
        }}
      >
        <input
          aria-label="New folder name"
          className="text-input"
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          value={newFolderName}
        />
        <Button disabled={!newFolderName.trim()} loading={creating} type="submit" variant="secondary">
          Create
        </Button>
      </form>

      {error ? <div style={{ marginTop: 12 }}><StatusMessage tone="error">{error}</StatusMessage></div> : null}

      <div className="folder-list">
        {loading ? <Skeleton rows={4} /> : null}
        {!loading && folders.length === 0 ? <div className="empty-state">No subfolders here.</div> : null}
        {!loading
          ? folders.map((folder) => (
              <button
                className="folder-row"
                key={folder.id}
                onClick={() => void loadFolders(folder.pathDisplay)}
                type="button"
              >
                <span className="truncate">📁 {folder.name}</span>
                <span className="muted">›</span>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
