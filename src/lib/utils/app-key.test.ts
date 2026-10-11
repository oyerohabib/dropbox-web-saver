import { describe, expect, it } from "vitest";
import { getSetupErrorHint, isLikelyAppKey, maskAppKey } from "./app-key";

describe("isLikelyAppKey", () => {
  it("accepts a typical Dropbox app key", () => {
    expect(isLikelyAppKey("abc123xyz456def")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isLikelyAppKey("  abc123xyz456def \n")).toBe(true);
  });

  it.each(["", "short", "has spaces inside", "UPPERCASEKEY123", "a".repeat(30), "abc-123_xyz.456"])(
    "rejects %j",
    (value) => {
      expect(isLikelyAppKey(value)).toBe(false);
    },
  );
});

describe("maskAppKey", () => {
  it("keeps the first and last three characters", () => {
    expect(maskAppKey("abc123xyz456def")).toBe("abc…def");
  });

  it("fully masks very short values", () => {
    expect(maskAppKey("abcd")).toBe("••••");
  });
});

describe("getSetupErrorHint", () => {
  it.each([
    ["Invalid redirect_uri. It must exactly match one of the redirect URIs you've pre-configured for your app", 3],
    ["Invalid client_id", 4],
    ["invalid_client: Invalid client_id or client_secret", 4],
    ["invalid_scope: Your app is not permitted to access this endpoint", 2],
    ["Authorization page could not be loaded.", 3],
  ])("maps %j to step %i", (message, step) => {
    expect(getSetupErrorHint(message).step).toBe(step);
  });

  it("treats a closed window as a retry without a specific step", () => {
    const hint = getSetupErrorHint("The user did not approve access.");
    expect(hint.step).toBeNull();
    expect(hint.hint).toMatch(/Try again/);
  });

  it("falls back to a general hint", () => {
    expect(getSetupErrorHint("Something unexpected").step).toBeNull();
  });
});
