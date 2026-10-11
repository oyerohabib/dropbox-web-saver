import type { AssetCandidate, SaveResult } from "../types";
import { deriveCandidateFilename } from "./filename";

export interface BatchItemResult {
  asset: AssetCandidate;
  result: SaveResult;
}

export interface BatchFailure {
  asset: AssetCandidate;
  filename: string;
  message: string;
}

export interface BatchSummary {
  total: number;
  savedCount: number;
  failures: BatchFailure[];
  switchedToInstant: boolean;
  /** Sites the user must allow before the failed files can be retried. */
  permissionOrigins: string[];
}

export function summarizeBatch(results: BatchItemResult[]): BatchSummary {
  const failures: BatchFailure[] = results
    .filter(({ result }) => !result.ok)
    .map(({ asset, result }) => ({
      asset,
      filename: result.filename || deriveCandidateFilename(asset),
      message: result.message || "The save failed.",
    }));

  return {
    total: results.length,
    savedCount: results.length - failures.length,
    failures,
    switchedToInstant: results.some(({ result }) => Boolean(result.switchedToInstant)),
    permissionOrigins: [
      ...new Set(
        results.flatMap(({ result }) =>
          result.status === "needs_permission" && result.permissionOrigin ? [result.permissionOrigin] : [],
        ),
      ),
    ],
  };
}
