import { canUseUrlImport, detectAssetType } from "./asset";

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
