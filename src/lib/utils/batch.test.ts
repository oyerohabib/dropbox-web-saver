import type { AssetCandidate, SaveResult } from "../types";
import { summarizeBatch } from "./batch";

function asset(name: string): AssetCandidate {
  return {
    sourceUrl: `https://example.com/${name}`,
    pageUrl: "https://example.com",
    detectedType: "image",
    suggestedFilename: null,
    requiresAuthenticatedFetch: false,
  };
}

const saved = (filename: string, extra: Partial<SaveResult> = {}): SaveResult => ({
  ok: true,
  status: "success",
  filename,
  message: `Saved ${filename}.`,
  ...extra,
});

describe("summarizeBatch", () => {
  it("counts a fully successful batch", () => {
    const summary = summarizeBatch([
      { asset: asset("a.jpg"), result: saved("a.jpg") },
      { asset: asset("b.jpg"), result: saved("b.jpg") },
    ]);

    expect(summary).toEqual({
      total: 2,
      savedCount: 2,
      failures: [],
      switchedToInstant: false,
      permissionOrigins: [],
    });
  });

  it("lists failures with a filename and message", () => {
    const failedAsset = asset("c.jpg");
    const summary = summarizeBatch([
      { asset: asset("a.jpg"), result: saved("a.jpg") },
      { asset: failedAsset, result: { ok: false, status: "failed", message: "Network error." } },
    ]);

    expect(summary.savedCount).toBe(1);
    expect(summary.failures).toEqual([{ asset: failedAsset, filename: "c.jpg", message: "Network error." }]);
  });

  it("reports when any save switched to instant saving", () => {
    const summary = summarizeBatch([
      { asset: asset("a.jpg"), result: saved("a.jpg", { switchedToInstant: true }) },
      { asset: asset("b.jpg"), result: saved("b.jpg") },
    ]);

    expect(summary.switchedToInstant).toBe(true);
  });

  it("collects each site that needs access once", () => {
    const needsAccess = (name: string, origin: string): SaveResult => ({
      ok: false,
      status: "needs_permission",
      message: "Allow access.",
      permissionOrigin: origin,
    });
    const summary = summarizeBatch([
      { asset: asset("a.jpg"), result: needsAccess("a.jpg", "https://cdn.one.test/*") },
      { asset: asset("b.jpg"), result: needsAccess("b.jpg", "https://cdn.one.test/*") },
      { asset: asset("c.jpg"), result: needsAccess("c.jpg", "https://cdn.two.test/*") },
      { asset: asset("d.jpg"), result: { ok: false, status: "failed", message: "Network error." } },
    ]);

    expect(summary.failures).toHaveLength(4);
    expect(summary.permissionOrigins).toEqual(["https://cdn.one.test/*", "https://cdn.two.test/*"]);
  });

  it("handles an empty batch", () => {
    expect(summarizeBatch([])).toEqual({
      total: 0,
      savedCount: 0,
      failures: [],
      switchedToInstant: false,
      permissionOrigins: [],
    });
  });
});
