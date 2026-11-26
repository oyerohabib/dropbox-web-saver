/**
 * Google OAuth client id / secret baked in at build time.
 * Web application clients need the secret for the token endpoint; treat it like
 * an installed-app secret (visible in the built extension, not a server secret).
 */
export function readBuiltinGoogleClientId(): string | null {
  const value = import.meta.env.WXT_GOOGLE_CLIENT_ID;
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function readBuiltinGoogleClientSecret(): string | null {
  const value = import.meta.env.WXT_GOOGLE_CLIENT_SECRET;
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}
