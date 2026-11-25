import type { AssetTriggerKind, StorageProviderId } from "../types";
import { isStorageProviderId } from "../providers";

export const MENU_IDS = {
  image: "save-image",
  video: "save-video",
  audio: "save-audio",
  link: "save-link",
  scan: "scan-page-assets",
  preferences: "open-save-preferences",
} as const;

const TRIGGER_BY_PARENT: Record<string, AssetTriggerKind> = {
  [MENU_IDS.image]: "image",
  [MENU_IDS.video]: "video",
  [MENU_IDS.audio]: "audio",
  [MENU_IDS.link]: "linked_file",
};

export function providerMenuId(parentId: string, provider: StorageProviderId): string {
  return `${parentId}:${provider}`;
}

export function parseProviderMenuId(
  menuItemId: string,
): { triggerKind: AssetTriggerKind; provider: StorageProviderId } | null {
  const separator = menuItemId.lastIndexOf(":");
  if (separator <= 0) return null;
  const parentId = menuItemId.slice(0, separator);
  const provider = menuItemId.slice(separator + 1);
  const triggerKind = TRIGGER_BY_PARENT[parentId];
  if (!triggerKind || !isStorageProviderId(provider)) return null;
  return { triggerKind, provider };
}

export function parentMenuTitle(trigger: "image" | "video" | "audio" | "link"): string {
  switch (trigger) {
    case "image":
      return "Save this image to…";
    case "video":
      return "Save this video to…";
    case "audio":
      return "Save this audio to…";
    case "link":
      return "Save the file this link opens to…";
  }
}
