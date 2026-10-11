import { describe, expect, it } from "vitest";
import { getDropboxWebUrl, getOriginPattern, getPatternHost } from "./url";

describe("getOriginPattern", () => {
  it("builds a match pattern for the URL's site", () => {
    expect(getOriginPattern("https://cdn.example.com:8443/img/a.png?x=1")).toBe("https://cdn.example.com/*");
    expect(getOriginPattern("http://example.com/file.pdf")).toBe("http://example.com/*");
  });

  it("ignores non-web URLs", () => {
    expect(getOriginPattern("data:image/png;base64,AAAA")).toBeNull();
    expect(getOriginPattern("not a url")).toBeNull();
  });
});

describe("getPatternHost", () => {
  it("shows just the host name", () => {
    expect(getPatternHost("https://cdn.example.com/*")).toBe("cdn.example.com");
  });
});

describe("getDropboxWebUrl", () => {
  it("links the Dropbox root for /", () => {
    expect(getDropboxWebUrl("/")).toBe("https://www.dropbox.com/home");
  });

  it("encodes each folder segment", () => {
    expect(getDropboxWebUrl("/Camera Uploads/Web & Saves")).toBe(
      "https://www.dropbox.com/home/Camera%20Uploads/Web%20%26%20Saves",
    );
  });

  it("ignores trailing and repeated slashes", () => {
    expect(getDropboxWebUrl("/Designs//2026/")).toBe("https://www.dropbox.com/home/Designs/2026");
  });
});
