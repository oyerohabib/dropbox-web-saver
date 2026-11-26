import {
  GOOGLE_DRIVE_SCOPES,
  GOOGLE_OAUTH_AUTHORIZE,
  GOOGLE_OAUTH_REVOKE,
  GOOGLE_OAUTH_TOKEN,
  GOOGLE_USERINFO_ENDPOINT,
  TOKEN_EXPIRY_SKEW_MS,
  googleDriveCanListExistingFolders,
} from "./constants";
import {
  readBuiltinGoogleClientId,
  readBuiltinGoogleClientSecret,
} from "./google-drive-client-id";
import { getGoogleDriveTokens, setGoogleDriveTokens } from "./storage";
import type { GoogleDriveAuthState, GoogleDriveTokens } from "./types";
import { SavePipelineError } from "./utils/errors";
import { createCodeChallenge, createCodeVerifier } from "./utils/pkce";

function appendClientAuth(body: URLSearchParams, clientId: string) {
  body.set("client_id", clientId);
  const clientSecret = readBuiltinGoogleClientSecret();
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
}

function readOAuthError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string; error_description?: string };
    if (parsed.error_description) return parsed.error_description;
    if (parsed.error) return parsed.error;
  } catch {
    // fall through
  }
  return body.slice(0, 200);
}

async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  existingRefreshToken?: string;
}): Promise<GoogleDriveTokens> {
  if (!readBuiltinGoogleClientSecret()) {
    throw new Error(
      "Google token exchange needs WXT_GOOGLE_CLIENT_SECRET. Copy the client secret from your Web application OAuth client into .env, rebuild, and try again.",
    );
  }

  const body = new URLSearchParams({
    code: args.code,
    grant_type: "authorization_code",
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
  });
  appendClientAuth(body, args.clientId);

  const response = await fetch(GOOGLE_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const detail = readOAuthError(await response.text().catch(() => ""));
    throw new Error(
      `Google token exchange failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = await response.json();
  const refreshToken = payload.refresh_token || args.existingRefreshToken;
  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Disconnect any prior Web Saver grant in your Google account, then connect again.",
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scope: payload.scope || GOOGLE_DRIVE_SCOPES.join(" "),
  };
}

async function refreshTokens(clientId: string, refreshToken: string): Promise<GoogleDriveTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  appendClientAuth(body, clientId);

  const response = await fetch(GOOGLE_OAUTH_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (response.status === 400 || response.status === 401) {
    await setGoogleDriveTokens(null);
    throw new SavePipelineError(
      "Your Google Drive connection expired or was revoked. Reconnect Google Drive to continue.",
      "TOKEN_EXPIRED",
    );
  }
  if (!response.ok) {
    const detail = readOAuthError(await response.text().catch(() => ""));
    throw new Error(
      `Google token refresh failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = await response.json();
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
    scope: payload.scope,
  };
}

export async function getGoogleDriveAuthState(): Promise<GoogleDriveAuthState> {
  // launchWebAuthFlow requires a Google "Web application" client with this exact redirect URI.
  const redirectUri = chrome.identity.getRedirectURL();
  const clientId = readBuiltinGoogleClientId();

  if (!clientId) {
    return {
      status: "missing_client_id",
      clientId: null,
      redirectUri,
    };
  }

  const tokens = await getGoogleDriveTokens();
  if (!tokens) {
    return {
      status: "signed_out",
      clientId,
      redirectUri,
    };
  }

  return {
    status: "signed_in",
    clientId,
    redirectUri,
    accountEmail: tokens.accountEmail,
    expiresAt: tokens.expiresAt,
    needsReconnect: !googleDriveCanListExistingFolders(tokens.scope),
  };
}

export async function connectGoogleDrive(): Promise<GoogleDriveAuthState> {
  const clientId = readBuiltinGoogleClientId();
  if (!clientId) {
    throw new Error("No Google client id is available. Set WXT_GOOGLE_CLIENT_ID when building.");
  }
  if (!readBuiltinGoogleClientSecret()) {
    throw new Error(
      "Set WXT_GOOGLE_CLIENT_SECRET in .env (from your Web application OAuth client), rebuild, and try again.",
    );
  }

  // Must match an Authorized redirect URI on a Web application OAuth client.
  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = crypto.randomUUID();
  const authorizeUrl = new URL(GOOGLE_OAUTH_AUTHORIZE);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("include_granted_scopes", "true");
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPES.join(" "));

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl.toString(),
    interactive: true,
  });

  if (!callbackUrl) throw new Error("Google Drive sign-in did not complete.");

  const parsed = new URL(callbackUrl);
  if (parsed.searchParams.get("state") !== state) {
    throw new Error("Google Drive sign-in state mismatch.");
  }
  const code = parsed.searchParams.get("code");
  if (!code) {
    throw new Error(parsed.searchParams.get("error_description") || "Google Drive sign-in was cancelled.");
  }

  const existing = await getGoogleDriveTokens();
  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: verifier,
    clientId,
    redirectUri,
    existingRefreshToken: existing?.refreshToken,
  });

  await setGoogleDriveTokens(tokens);
  await setGoogleAccountEmail().catch(() => undefined);
  return getGoogleDriveAuthState();
}

export async function disconnectGoogleDrive(): Promise<void> {
  const tokens = await getGoogleDriveTokens();
  if (tokens) {
    const body = new URLSearchParams({ token: tokens.accessToken });
    await fetch(`${GOOGLE_OAUTH_REVOKE}?${body.toString()}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await setGoogleDriveTokens(null);
}

export async function getValidGoogleAccessToken(): Promise<string> {
  const clientId = readBuiltinGoogleClientId();
  const tokens = await getGoogleDriveTokens();

  if (!clientId || !tokens) {
    throw new SavePipelineError(
      "Google Drive is not connected. Connect Google Drive to continue.",
      "AUTH_REQUIRED",
    );
  }

  if (tokens.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
    return tokens.accessToken;
  }

  const refreshed = await refreshTokens(clientId, tokens.refreshToken);
  await setGoogleDriveTokens({
    ...refreshed,
    accountEmail: tokens.accountEmail,
    scope: refreshed.scope || tokens.scope,
  });
  return refreshed.accessToken;
}

export async function setGoogleAccountEmail(accountEmail?: string): Promise<void> {
  const tokens = await getGoogleDriveTokens();
  if (!tokens) return;

  if (accountEmail) {
    await setGoogleDriveTokens({ ...tokens, accountEmail });
    return;
  }

  const accessToken = await getValidGoogleAccessToken();
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return;
  const payload = (await response.json()) as { email?: string };
  if (!payload.email) return;
  await setGoogleDriveTokens({
    ...tokens,
    accountEmail: payload.email,
  });
}
