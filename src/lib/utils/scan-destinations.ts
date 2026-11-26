import type { StorageProviderId } from "../types";

export function defaultScanDestinations(input: {
  dropboxConnected: boolean;
  driveConnected: boolean;
  lastUsedProvider?: StorageProviderId | null;
}): StorageProviderId[] {
  const connected: StorageProviderId[] = [];
  if (input.dropboxConnected) connected.push("dropbox");
  if (input.driveConnected) connected.push("google_drive");

  if (connected.length === 1) return connected;
  if (connected.length === 0) return ["google_drive"];

  if (input.lastUsedProvider && connected.includes(input.lastUsedProvider)) {
    return [input.lastUsedProvider];
  }
  return ["dropbox"];
}
