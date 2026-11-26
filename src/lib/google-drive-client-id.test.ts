import { afterEach, describe, expect, it, vi } from "vitest";
import { readBuiltinGoogleClientId, readBuiltinGoogleClientSecret } from "./google-drive-client-id";

describe("readBuiltinGoogleClientId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a trimmed client id when set", () => {
    vi.stubEnv("WXT_GOOGLE_CLIENT_ID", "  client.apps.googleusercontent.com  ");
    expect(readBuiltinGoogleClientId()).toBe("client.apps.googleusercontent.com");
  });

  it("returns null when unset", () => {
    vi.stubEnv("WXT_GOOGLE_CLIENT_ID", "");
    expect(readBuiltinGoogleClientId()).toBeNull();
  });
});

describe("readBuiltinGoogleClientSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a trimmed client secret when set", () => {
    vi.stubEnv("WXT_GOOGLE_CLIENT_SECRET", "  secret-value  ");
    expect(readBuiltinGoogleClientSecret()).toBe("secret-value");
  });

  it("returns null when unset", () => {
    vi.stubEnv("WXT_GOOGLE_CLIENT_SECRET", "");
    expect(readBuiltinGoogleClientSecret()).toBeNull();
  });
});
