import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECENT_SAVE_LIMIT } from "./constants";
import { appendRecentSave, clearRecentSaves, getRecentSaves, getSettings, updateSettings } from "./storage";
import type { RecentSaveRecord } from "./types";

function makeRecord(id: string): RecentSaveRecord {
  return {
    id,
    filename: `${id}.png`,
    sourceDomain: "example.com",
    destinationPath: "/Saves",
    success: true,
    timestamp: 0,
    message: "Saved",
  };
}

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
      async remove(key: string) {
        store.delete(key);
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

describe("recent saves", () => {
  beforeEach(() => {
    store.clear();
  });

  it("keeps only the newest saves up to the limit", async () => {
    for (let index = 0; index < RECENT_SAVE_LIMIT + 3; index += 1) {
      await appendRecentSave(makeRecord(`save-${index}`));
    }

    const saves = await getRecentSaves();
    expect(saves).toHaveLength(RECENT_SAVE_LIMIT);
    expect(saves[0].id).toBe(`save-${RECENT_SAVE_LIMIT + 2}`);
  });

  it("clears the history", async () => {
    await appendRecentSave(makeRecord("first"));
    await clearRecentSaves();

    expect(await getRecentSaves()).toEqual([]);
  });
});
