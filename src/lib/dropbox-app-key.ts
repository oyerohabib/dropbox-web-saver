import type { DropboxAppKeySource } from "./types";

/**
 * Personal keys saved in extension settings win. Otherwise use the public
 * client id baked in at build time via WXT_DROPBOX_APP_KEY.
 */
export function resolveDropboxAppKey(
  savedAppKey: string | null | undefined,
  builtinAppKey: string | null | undefined,
): { appKey: string | null; appKeySource: DropboxAppKeySource } {
  const saved = savedAppKey?.trim() ?? "";
  if (saved) return { appKey: saved, appKeySource: "personal" };
  const builtin = builtinAppKey?.trim() ?? "";
  if (builtin) return { appKey: builtin, appKeySource: "builtin" };
  return { appKey: null, appKeySource: "none" };
}

export function readBuiltinAppKey(): string | null {
  const value = import.meta.env.WXT_DROPBOX_APP_KEY;
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}
