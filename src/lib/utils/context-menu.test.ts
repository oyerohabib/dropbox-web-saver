import { describe, expect, it } from "vitest";
import { MENU_IDS, parseProviderMenuId, providerMenuId } from "./context-menu";

describe("providerMenuId", () => {
  it("encodes trigger and provider", () => {
    expect(providerMenuId(MENU_IDS.image, "dropbox")).toBe("save-image:dropbox");
    expect(providerMenuId(MENU_IDS.link, "google_drive")).toBe("save-link:google_drive");
  });
});

describe("parseProviderMenuId", () => {
  it("parses dropbox and google drive child items", () => {
    expect(parseProviderMenuId("save-image:dropbox")).toEqual({
      triggerKind: "image",
      provider: "dropbox",
    });
    expect(parseProviderMenuId("save-video:google_drive")).toEqual({
      triggerKind: "video",
      provider: "google_drive",
    });
    expect(parseProviderMenuId("save-link:google_drive")).toEqual({
      triggerKind: "linked_file",
      provider: "google_drive",
    });
  });

  it("rejects unknown parents or providers", () => {
    expect(parseProviderMenuId("save-image")).toBeNull();
    expect(parseProviderMenuId("save-image:onedrive")).toBeNull();
    expect(parseProviderMenuId(MENU_IDS.scan)).toBeNull();
  });
});
