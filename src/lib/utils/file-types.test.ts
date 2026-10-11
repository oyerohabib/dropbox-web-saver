import { detectAssetType } from "./asset";
import { getFileTypeForPath, SUPPORTED_FILE_TYPES } from "./file-types";
import { isLikelyDirectAssetUrl } from "./url";

describe("supported file types", () => {
  it("lists each extension only once", () => {
    const extensions = SUPPORTED_FILE_TYPES.flatMap((group) => group.extensions);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("maps extensions to asset types regardless of case", () => {
    expect(getFileTypeForPath("/photos/IMG_001.HEIC")).toBe("image");
    expect(getFileTypeForPath("/clips/intro.mkv")).toBe("video");
    expect(getFileTypeForPath("/podcast/episode.opus")).toBe("audio");
    expect(getFileTypeForPath("/files/budget.xlsx")).toBe("link");
    expect(getFileTypeForPath("/files/backup.7z")).toBe("link");
  });

  it("ignores web pages and paths without an extension", () => {
    expect(getFileTypeForPath("/blog/post.html")).toBeNull();
    expect(getFileTypeForPath("/photo-1234")).toBeNull();
    expect(getFileTypeForPath("/")).toBeNull();
  });

  it("treats office documents and archives as downloadable links", () => {
    expect(detectAssetType("https://example.com/report.docx")).toBe("link");
    expect(detectAssetType("https://example.com/slides.pptx?download=1")).toBe("link");
    expect(isLikelyDirectAssetUrl("https://example.com/archive.tar")).toBe(true);
    expect(isLikelyDirectAssetUrl("https://example.com/about")).toBe(false);
  });
});
