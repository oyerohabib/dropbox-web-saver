import { useEffect, useState } from "react";
import { sendBackgroundMessage } from "../lib/browser";
import { STORAGE_KEYS } from "../lib/storage";
import type { ExtensionSettings, FolderBehavior, SaveMode, SavePreferences } from "../lib/types";
import { Button, SegmentedControl, Skeleton, StatusMessage, Toggle } from "./ui";

interface PreferencesFormProps {
  variant: "compact" | "full";
  onChooseFolder: () => void;
  onReady?: () => void;
}

const SAVED_TICK_MS = 1_500;

export function PreferencesForm({ variant, onChooseFolder, onReady }: PreferencesFormProps) {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const isFull = variant === "full";

  useEffect(() => {
    const load = () =>
      sendBackgroundMessage<ExtensionSettings>({ type: "GET_SETTINGS" })
        .then(setSettings)
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load preferences."));
    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && STORAGE_KEYS.settings in changes) void load();
    };
    void load();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, []);

  const hasSettings = settings !== null;
  useEffect(() => {
    if (hasSettings) onReady?.();
  }, [hasSettings]);

  useEffect(() => {
    if (savedAt === null) return;
    const timeout = setTimeout(() => setSavedAt(null), SAVED_TICK_MS);
    return () => clearTimeout(timeout);
  }, [savedAt]);

  async function update(patch: Partial<SavePreferences>) {
    if (!settings) return;
    const previous = settings;
    const savePreferences = { ...settings.savePreferences, ...patch };
    setSettings({ ...settings, savePreferences });
    setError(null);
    try {
      const next = await sendBackgroundMessage<ExtensionSettings>({
        type: "SAVE_SETTINGS",
        settings: { savePreferences: patch },
      });
      setSettings(next);
      setSavedAt(Date.now());
    } catch (saveError) {
      setSettings(previous);
      setError(saveError instanceof Error ? saveError.message : "Could not save your preferences.");
    }
  }

  if (!settings) {
    return error ? <StatusMessage tone="error">{error}</StatusMessage> : <Skeleton rows={3} />;
  }

  const { saveMode, folderBehavior, promptForRename } = settings.savePreferences;

  return (
    <div className="stack">
      <SegmentedControl<SaveMode>
        description={
          isFull
            ? saveMode === "reviewed"
              ? settings.saveModeSetByUser
                ? "A small window opens so you can check the name and folder before saving."
                : "Your first save opens a small window so you can pick a folder. After that, saves happen instantly."
              : "Right-click → save uploads immediately. The window only opens if a folder or name is still needed."
            : undefined
        }
        label="When I save"
        onChange={(value) => void update({ saveMode: value })}
        options={[
          { value: "reviewed", label: "Review first" },
          { value: "one_click", label: "Save instantly" },
        ]}
        value={saveMode}
      />
      <SegmentedControl<FolderBehavior>
        description={
          isFull
            ? folderBehavior === "remember_last"
              ? "Saves go to the last folder you used."
              : "You pick a folder every time you save."
            : undefined
        }
        label="Folder"
        onChange={(value) => void update({ folderBehavior: value })}
        options={[
          { value: "remember_last", label: "Use last folder" },
          { value: "always_ask", label: "Ask every time" },
        ]}
        value={folderBehavior}
      />
      <Toggle
        checked={promptForRename}
        description={isFull ? "Shows an editable file name in the review window." : undefined}
        label="Let me rename files before saving"
        onChange={(checked) => void update({ promptForRename: checked })}
      />
      <div className="row row-between">
        <div className="row" style={{ minWidth: 0 }}>
          <span className="muted nowrap">Default folder</span>
          <span className="path-pill" title={settings.lastUsedFolderPath ?? undefined}>
            {settings.lastUsedFolderPath || "Not set"}
          </span>
        </div>
        <Button onClick={onChooseFolder} variant="ghost">
          Change
        </Button>
      </div>
      {savedAt !== null || error ? (
        <div aria-live="polite" className="row">
          {savedAt !== null ? <span className="saved-tick">✓ Saved</span> : null}
          {error ? <span className="danger-text muted">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
