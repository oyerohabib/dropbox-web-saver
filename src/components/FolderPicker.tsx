import { useEffect, useState } from "react";
import type { FolderEntry } from "../lib/types";
import { sendBackgroundMessage } from "../lib/browser";

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
        <div>
          <div className="eyebrow">Dropbox folder</div>
          <div className="path-pill">{currentPath}</div>
        </div>
        <button
          className="ghost-button"
          disabled={currentPath === "/"}
          onClick={() => void loadFolders(getParentPath(currentPath))}
          type="button"
        >
          Up
        </button>
      </div>

      <div className="folder-actions">
        <button className="primary-button" onClick={() => onSelect(currentPath)} type="button">
          Use This Folder
        </button>
        {selectedPath === currentPath ? <span className="badge success">Selected</span> : null}
      </div>

      <div className="create-folder">
        <input
          className="text-input"
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="Create a new folder"
          value={newFolderName}
        />
        <button className="secondary-button" disabled={creating} onClick={() => void createFolder()} type="button">
          {creating ? "Creating..." : "Create"}
        </button>
      </div>

      {error ? <div className="callout error">{error}</div> : null}

      <div className="folder-list">
        {loading ? <div className="muted">Loading folders...</div> : null}
        {!loading && folders.length === 0 ? <div className="muted">No folders here yet.</div> : null}
        {folders.map((folder) => (
          <button
            className="folder-row"
            key={folder.id}
            onClick={() => void loadFolders(folder.pathDisplay)}
            type="button"
          >
            <span>{folder.name}</span>
            <span className="muted">Open</span>
          </button>
        ))}
      </div>
    </div>
  );
}
