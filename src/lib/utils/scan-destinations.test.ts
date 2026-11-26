import { describe, expect, it } from "vitest";
import { defaultScanDestinations } from "./scan-destinations";

describe("defaultScanDestinations", () => {
  it("selects the only connected storage", () => {
    expect(
      defaultScanDestinations({ dropboxConnected: true, driveConnected: false }),
    ).toEqual(["dropbox"]);
    expect(
      defaultScanDestinations({ dropboxConnected: false, driveConnected: true }),
    ).toEqual(["google_drive"]);
  });

  it("selects the last used storage when both are connected", () => {
    expect(
      defaultScanDestinations({
        dropboxConnected: true,
        driveConnected: true,
        lastUsedProvider: "google_drive",
      }),
    ).toEqual(["google_drive"]);
    expect(
      defaultScanDestinations({
        dropboxConnected: true,
        driveConnected: true,
        lastUsedProvider: "dropbox",
      }),
    ).toEqual(["dropbox"]);
  });

  it("selects Google Drive when neither storage is connected", () => {
    expect(
      defaultScanDestinations({ dropboxConnected: false, driveConnected: false }),
    ).toEqual(["google_drive"]);
  });

  it("falls back to Dropbox when both are connected and none was used yet", () => {
    expect(
      defaultScanDestinations({ dropboxConnected: true, driveConnected: true }),
    ).toEqual(["dropbox"]);
  });

  it("ignores a last used storage that is no longer connected", () => {
    expect(
      defaultScanDestinations({
        dropboxConnected: true,
        driveConnected: false,
        lastUsedProvider: "google_drive",
      }),
    ).toEqual(["dropbox"]);
  });
});
