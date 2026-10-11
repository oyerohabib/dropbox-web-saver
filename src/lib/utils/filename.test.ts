import {
  deriveFilename,
  joinDropboxPath,
  parseContentDispositionFilename,
  sanitizeFilename,
} from "./filename";

describe("filename utilities", () => {
  it("sanitizes illegal filename characters", () => {
    expect(sanitizeFilename("hero:/banner?.png")).toBe("hero-banner-.png");
  });

  it("derives a filename from the source url", () => {
    expect(deriveFilename("https://cdn.example.com/assets/mockup.png")).toBe("mockup.png");
  });

  it("falls back to mime type when the url does not include an extension", () => {
    expect(deriveFilename("https://example.com/render/latest", null, "image/jpeg")).toBe("latest.jpg");
  });

  it("prefers an explicit preferred filename over generic url naming", () => {
    expect(
      deriveFilename("https://cdn.example.com/image?id=123", null, "image/png", {
        preferredFilename: "homepage-hero",
      }),
    ).toBe("homepage-hero.png");
  });

  it("parses content disposition filenames", () => {
    expect(
      parseContentDispositionFilename(`attachment; filename="campaign-banner.webp"`),
    ).toBe("campaign-banner.webp");
  });

  it("builds a Dropbox path without duplicate slashes", () => {
    expect(joinDropboxPath("/Designs", "mockup.png")).toBe("/Designs/mockup.png");
    expect(joinDropboxPath("/", "mockup.png")).toBe("/mockup.png");
  });
});
