import {
  DROPBOX_OAUTH_AUTHORIZE,
  DROPBOX_OAUTH_REVOKE,
  DROPBOX_OAUTH_TOKEN,
  DROPBOX_SCOPES,
  TOKEN_EXPIRY_SKEW_MS,
} from "./constants";
import { getSettings, getTokens, setTokens } from "./storage";
import type { DropboxAuthState, DropboxTokens } from "./types";
import { SavePipelineError } from "./utils/errors";
import { createCodeChallenge, createCodeVerifier } from "./utils/pkce";

async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier: string;
  appKey: string;
  redirectUri: string;
}): Promise<DropboxTokens> {
  const body = new URLSearchParams({
    code: args.code,
    grant_type: "authorization_code",
    client_id: args.appKey,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
  });

  const response = await fetch(DROPBOX_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Dropbox token exchange failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

async function refreshTokens(appKey: string, refreshToken: string): Promise<DropboxTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: appKey,
  });

  const response = await fetch(DROPBOX_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (response.status === 400 || response.status === 401) {
    await setTokens(null);
    throw new SavePipelineError(
      "Your Dropbox connection expired or was revoked. Reconnect Dropbox to continue.",
      "TOKEN_EXPIRED",
    );
  }
  if (!response.ok) {
    throw new Error(`Dropbox token refresh failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token,
    refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

export async function getAuthState(): Promise<DropboxAuthState> {
  const settings = await getSettings();
  const redirectUri = chrome.identity.getRedirectURL("dropbox");

  if (!settings.appKey) {
    return {
      status: "missing_app_key",
      appKey: null,
      redirectUri,
    };
  }

  const tokens = await getTokens();
  if (!tokens) {
    return {
      status: "signed_out",
      appKey: settings.appKey,
      redirectUri,
    };
  }

  return {
    status: "signed_in",
    appKey: settings.appKey,
    redirectUri,
    accountEmail: tokens.accountEmail,
    expiresAt: tokens.expiresAt,
  };
}

export async function connectDropbox(): Promise<DropboxAuthState> {
  const settings = await getSettings();
  if (!settings.appKey) {
    throw new Error("Set a Dropbox app key before connecting.");
  }

  const redirectUri = chrome.identity.getRedirectURL("dropbox");
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = crypto.randomUUID();
  const authorizeUrl = new URL(DROPBOX_OAUTH_AUTHORIZE);
  authorizeUrl.searchParams.set("client_id", settings.appKey);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("token_access_type", "offline");
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", DROPBOX_SCOPES.join(" "));

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl.toString(),
    interactive: true,
  });

  if (!callbackUrl) throw new Error("Dropbox sign-in did not complete.");

  const parsed = new URL(callbackUrl);
  if (parsed.searchParams.get("state") !== state) {
    throw new Error("Dropbox sign-in state mismatch.");
  }
  const code = parsed.searchParams.get("code");
  if (!code) {
    throw new Error(parsed.searchParams.get("error_description") || "Dropbox sign-in was cancelled.");
  }

  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: verifier,
    appKey: settings.appKey,
    redirectUri,
  });

  await setTokens(tokens);
  return getAuthState();
}

export async function disconnectDropbox(): Promise<void> {
  const tokens = await getTokens();
  if (tokens) {
    await fetch(DROPBOX_OAUTH_REVOKE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    }).catch(() => undefined);
  }
  await setTokens(null);
}

export async function getValidAccessToken(): Promise<string> {
  const settings = await getSettings();
  const tokens = await getTokens();

  if (!settings.appKey || !tokens) {
    throw new SavePipelineError("Dropbox is not connected. Connect Dropbox to continue.", "AUTH_REQUIRED");
  }

  if (tokens.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
    return tokens.accessToken;
  }

  const refreshed = await refreshTokens(settings.appKey, tokens.refreshToken);
  await setTokens({
    ...refreshed,
    accountEmail: tokens.accountEmail,
  });
  return refreshed.accessToken;
}

export async function setAccountEmail(accountEmail: string): Promise<void> {
  const tokens = await getTokens();
  if (!tokens) return;
  await setTokens({
    ...tokens,
    accountEmail,
  });
}
