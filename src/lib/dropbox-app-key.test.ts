import { describe, expect, it } from "vitest";
import { resolveDropboxAppKey } from "./dropbox-app-key";

describe("resolveDropboxAppKey", () => {
  it("uses a saved personal key ahead of the built-in key", () => {
    expect(resolveDropboxAppKey(" personal-key ", "builtin-key")).toEqual({
      appKey: "personal-key",
      appKeySource: "personal",
    });
  });

  it("falls back to the built-in public key when no personal key is saved", () => {
    expect(resolveDropboxAppKey(null, " builtin-key ")).toEqual({
      appKey: "builtin-key",
      appKeySource: "builtin",
    });
    expect(resolveDropboxAppKey("   ", "builtin-key").appKeySource).toBe("builtin");
  });

  it("reports no key when neither source has one", () => {
    expect(resolveDropboxAppKey(null, "  ")).toEqual({
      appKey: null,
      appKeySource: "none",
    });
  });
});
