import { describe, expect, it } from "vitest";
import type { ExtensionSettings, SaveResult } from "../types";
import { markUserSaveModeChoice, shouldAutoSwitchToInstant } from "./save-mode";

const firstTimeSettings: ExtensionSettings = {
  appKey: "key",
  lastUsedFolderPath: "/Photos",
  savePreferences: { saveMode: "reviewed", promptForRename: false, folderBehavior: "remember_last" },
  saveModeSetByUser: false,
};

const success: SaveResult = { ok: true, status: "success", message: "Saved" };

describe("shouldAutoSwitchToInstant", () => {
  it("switches after the first successful reviewed save", () => {
    expect(shouldAutoSwitchToInstant(firstTimeSettings, success)).toBe(true);
  });

  it("does not switch when the save failed", () => {
    expect(shouldAutoSwitchToInstant(firstTimeSettings, { ok: false, status: "failed", message: "Nope" })).toBe(false);
  });

  it("does not switch when already saving instantly", () => {
    const settings = { ...firstTimeSettings, savePreferences: { ...firstTimeSettings.savePreferences, saveMode: "one_click" as const } };
    expect(shouldAutoSwitchToInstant(settings, success)).toBe(false);
  });

  it("respects a save mode the user picked themselves", () => {
    expect(shouldAutoSwitchToInstant({ ...firstTimeSettings, saveModeSetByUser: true }, success)).toBe(false);
  });

  it("does not switch when the folder is asked for every time", () => {
    const settings = {
      ...firstTimeSettings,
      savePreferences: { ...firstTimeSettings.savePreferences, folderBehavior: "always_ask" as const },
    };
    expect(shouldAutoSwitchToInstant(settings, success)).toBe(false);
  });

  it("does not switch when renaming is on", () => {
    const settings = { ...firstTimeSettings, savePreferences: { ...firstTimeSettings.savePreferences, promptForRename: true } };
    expect(shouldAutoSwitchToInstant(settings, success)).toBe(false);
  });
});

describe("markUserSaveModeChoice", () => {
  it("marks patches that change the save mode", () => {
    expect(markUserSaveModeChoice({ savePreferences: { saveMode: "reviewed" } })).toEqual({
      savePreferences: { saveMode: "reviewed" },
      saveModeSetByUser: true,
    });
  });

  it("leaves other patches unchanged", () => {
    const patch = { savePreferences: { promptForRename: true }, lastUsedFolderPath: "/A" };
    expect(markUserSaveModeChoice(patch)).toBe(patch);
  });
});
