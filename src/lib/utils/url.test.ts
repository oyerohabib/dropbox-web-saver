import { describe, expect, it } from "vitest";
import { getDropboxWebUrl } from "./url";

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
