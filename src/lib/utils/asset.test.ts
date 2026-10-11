import type { AssetCandidate } from "../types";
import { canUseUrlImport, detectAssetType, isSmallAsset, rankScannedAssets } from "./asset";

function asset(name: string, overrides: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    sourceUrl: `https://example.com/${name}`,
    pageUrl: "https://example.com",
    detectedType: "image",
    suggestedFilename: null,
    requiresAuthenticatedFetch: false,
    ...overrides,
  };
}

describe("isSmallAsset", () => {
  it("flags avatars, favicons and icons", () => {
    expect(isSmallAsset(asset("avatar.jpg", { width: 64, height: 64 }))).toBe(true);
    expect(isSmallAsset(asset("favicon.png", { width: 16, height: 16 }))).toBe(true);
  });

  it("keeps content images and images with unknown size", () => {
    expect(isSmallAsset(asset("photo.jpg", { width: 1200, height: 800 }))).toBe(false);
    expect(isSmallAsset(asset("banner.jpg", { width: 600, height: 60 }))).toBe(false);
    expect(isSmallAsset(asset("lazy.jpg"))).toBe(false);
  });

  it("never flags non-image files", () => {
    expect(isSmallAsset(asset("clip.mp4", { detectedType: "video", width: 40, height: 40 }))).toBe(false);
  });
});

describe("rankScannedAssets", () => {
  it("lists media and files first, then images by size, then small images", () => {
    const ranked = rankScannedAssets([
      asset("avatar.jpg", { width: 64, height: 64 }),
      asset("thumb.jpg", { width: 200, height: 150 }),
      asset("report.pdf", { detectedType: "link" }),
      asset("hero.jpg", { width: 1600, height: 900 }),
      asset("song.mp3", { detectedType: "audio" }),
      asset("clip.mp4", { detectedType: "video" }),
    ]);

    expect(ranked.map((item) => item.sourceUrl.split("/").pop())).toEqual([
      "clip.mp4",
      "song.mp3",
      "report.pdf",
      "hero.jpg",
      "thumb.jpg",
      "avatar.jpg",
    ]);
  });

  it("does not modify the original list", () => {
    const original = [asset("a.jpg", { width: 50, height: 50 }), asset("b.jpg", { width: 500, height: 500 })];
    rankScannedAssets(original);
    expect(original[0].sourceUrl).toContain("a.jpg");
  });
});

describe("asset utilities", () => {
  it("detects asset types by extension", () => {
    expect(detectAssetType("https://example.com/file.png")).toBe("image");
    expect(detectAssetType("https://example.com/file.mp4")).toBe("video");
    expect(detectAssetType("https://example.com/file.mp3")).toBe("audio");
  });

  it("rejects authenticated or blob urls from url import", () => {
    expect(
      canUseUrlImport({
        sourceUrl: "blob:https://example.com/123",
        pageUrl: "https://example.com",
        detectedType: "image",
        suggestedFilename: null,
        requiresAuthenticatedFetch: true,
      }),
    ).toBe(false);
  });
});
