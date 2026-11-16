import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectDropbox, getAuthState, getValidAccessToken } from "./dropbox-auth";
import { STORAGE_KEYS } from "./storage";

const readBuiltinAppKey = vi.hoisted(() => vi.fn<() => string | null>(() => null));

vi.mock("./dropbox-app-key", async () => {
  const actual = await vi.importActual<typeof import("./dropbox-app-key")>("./dropbox-app-key");
  return {
    ...actual,
    readBuiltinAppKey,
  };
});

const store = new Map<string, unknown>();
let authorizeUrl = "";

function installChrome() {
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
    identity: {
      getRedirectURL: () => "https://extension.chromiumapp.org/dropbox",
      launchWebAuthFlow: vi.fn(async ({ url }: { url: string }) => {
        authorizeUrl = url;
        const state = new URL(url).searchParams.get("state");
        return `https://extension.chromiumapp.org/dropbox?code=auth-code&state=${state}`;
      }),
    },
  });
}

function tokenResponse(body: { access_token: string; refresh_token?: string; expires_in: number }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dropbox auth key resolution", () => {
  beforeEach(() => {
    store.clear();
    authorizeUrl = "";
    readBuiltinAppKey.mockReturnValue(null);
    installChrome();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stays signed out when settings have no key but the built-in key exists", async () => {
    readBuiltinAppKey.mockReturnValue("builtin-key");

    await expect(getAuthState()).resolves.toMatchObject({
      status: "signed_out",
      appKey: "builtin-key",
      appKeySource: "builtin",
    });
  });

  it("is missing an app key only when neither key exists", async () => {
    await expect(getAuthState()).resolves.toMatchObject({
      status: "missing_app_key",
      appKey: null,
      appKeySource: "none",
    });
  });

  it("keeps a saved personal key ahead of the built-in key", async () => {
    readBuiltinAppKey.mockReturnValue("builtin-key");
    store.set(STORAGE_KEYS.settings, { appKey: "personal-key" });

    await expect(getAuthState()).resolves.toMatchObject({
      status: "signed_out",
      appKey: "personal-key",
      appKeySource: "personal",
    });
  });

  it("connects with the personal key when one is saved", async () => {
    readBuiltinAppKey.mockReturnValue("builtin-key");
    store.set(STORAGE_KEYS.settings, { appKey: "personal-key" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const params = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
        expect(params.get("client_id")).toBe("personal-key");
        expect(params.get("grant_type")).toBe("authorization_code");
        return tokenResponse({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 14400,
        });
      }),
    );

    const state = await connectDropbox();

    expect(new URL(authorizeUrl).searchParams.get("client_id")).toBe("personal-key");
    expect(state).toMatchObject({
      status: "signed_in",
      appKey: "personal-key",
      appKeySource: "personal",
    });
  });

  it("connects with the built-in key when no personal key is saved", async () => {
    readBuiltinAppKey.mockReturnValue("builtin-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => tokenResponse({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 14400,
      })),
    );

    const state = await connectDropbox();

    expect(new URL(authorizeUrl).searchParams.get("client_id")).toBe("builtin-key");
    expect(state.appKeySource).toBe("builtin");
    expect(state.status).toBe("signed_in");
  });

  it("refuses to connect when no app key is available", async () => {
    await expect(connectDropbox()).rejects.toThrow(/app key/i);
  });

  it("refreshes an expired token with the built-in key", async () => {
    readBuiltinAppKey.mockReturnValue("builtin-key");
    store.set(STORAGE_KEYS.tokens, {
      accessToken: "old-access",
      refreshToken: "refresh-token",
      expiresAt: 0,
      accountEmail: "person@example.com",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const params = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
        expect(params.get("client_id")).toBe("builtin-key");
        expect(params.get("grant_type")).toBe("refresh_token");
        return tokenResponse({
          access_token: "new-access",
          expires_in: 14400,
        });
      }),
    );

    await expect(getValidAccessToken()).resolves.toBe("new-access");
    expect(store.get(STORAGE_KEYS.tokens)).toMatchObject({
      accessToken: "new-access",
      refreshToken: "refresh-token",
      accountEmail: "person@example.com",
    });
  });
});
