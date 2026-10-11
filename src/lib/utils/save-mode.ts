import type { ExtensionSettings, ExtensionSettingsPatch, SaveResult } from "../types";

// "Save instantly" still opens the review window when a folder must be picked or the name edited,
// so switching in those cases would promise something that doesn't happen.
export function shouldAutoSwitchToInstant(settings: ExtensionSettings, result: SaveResult) {
  const { saveMode, folderBehavior, promptForRename } = settings.savePreferences;
  return (
    result.ok
    && saveMode === "reviewed"
    && !settings.saveModeSetByUser
    && folderBehavior === "remember_last"
    && !promptForRename
  );
}

export function markUserSaveModeChoice(patch: ExtensionSettingsPatch): ExtensionSettingsPatch {
  return patch.savePreferences?.saveMode ? { ...patch, saveModeSetByUser: true } : patch;
}
