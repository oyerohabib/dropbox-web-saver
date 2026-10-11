import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "./storage";

const store = new Map<string, unknown>();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      async get(key: string) {
        return { [key]: store.get(key) };
      },
      async set(values: Record<string, unknown>) {
        Object.entries(values).forEach(([key, value]) => {
          store.set(key, value);
        });
      },
    },
  },
});

describe("storage settings", () => {
  beforeEach(() => {
    store.clear();
  });

  it("provides default save preferences for users with no saved settings", async () => {
    const settings = await getSettings();

    expect(settings.savePreferences).toEqual({
      saveMode: "reviewed",
      promptForRename: false,
      folderBehavior: "remember_last",
    });
  });

  it("merges partial preference updates without dropping other settings", async () => {
    await updateSettings({
      appKey: "dropbox-key",
      lastUsedFolderPath: "/Designs",
      savePreferences: {
        saveMode: "one_click",
        promptForRename: false,
        folderBehavior: "remember_last",
      },
    });

    const nextSettings = await updateSettings({
      savePreferences: {
        promptForRename: true,
      },
    });

    expect(nextSettings.appKey).toBe("dropbox-key");
    expect(nextSettings.lastUsedFolderPath).toBe("/Designs");
    expect(nextSettings.savePreferences).toEqual({
      saveMode: "one_click",
      promptForRename: true,
      folderBehavior: "remember_last",
    });
  });
});
