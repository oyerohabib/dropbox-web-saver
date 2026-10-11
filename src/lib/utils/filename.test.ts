import {
  deriveCandidateFilename,
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

  it("strips mime type parameters before choosing an extension", () => {
    expect(deriveFilename("https://example.com/render/latest", null, "image/webp; charset=binary")).toBe(
      "latest.webp",
    );
  });

  it("collapses whitespace and caps long element hints", () => {
    const longAlt = `A   person standing\non a mountain ${"at sunset ".repeat(20)}`;
    const filename = deriveFilename("https://images.example.com/photo-123", null, "image/jpeg", {
      elementTextHint: longAlt,
    });
    expect(filename.endsWith(".jpg")).toBe(true);
    expect(filename.startsWith("A person standing on a mountain")).toBe(true);
    expect(filename.length).toBeLessThanOrEqual(84);
  });

  it("adds the detected extension to a user-edited name without one", () => {
    expect(
      deriveCandidateFilename(
        {
          sourceUrl: "https://images.example.com/photo-123",
          pageUrl: "https://example.com",
          detectedType: "image",
          suggestedFilename: null,
          requiresAuthenticatedFetch: false,
          mimeType: "image/jpeg",
        },
        "my mountain shot",
      ),
    ).toBe("my mountain shot.jpg");
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
