import { describe, expect, it } from "vitest";
import { formatFolderPath, getBreadcrumbs, getFolderName, getParentPath, isSameFolder } from "./folder-path";

describe("getParentPath", () => {
  it.each([
    ["/", "/"],
    ["/Photos", "/"],
    ["/Photos/2026/Trips", "/Photos/2026"],
    ["/Photos/", "/"],
  ])("returns the parent of %j", (path, parent) => {
    expect(getParentPath(path)).toBe(parent);
  });
});

describe("getFolderName", () => {
  it("returns the last segment, or Dropbox for the root", () => {
    expect(getFolderName("/Photos/2026")).toBe("2026");
    expect(getFolderName("/")).toBe("Dropbox");
  });
});

describe("formatFolderPath", () => {
  it("names the root folder and leaves other paths alone", () => {
    expect(formatFolderPath("/")).toBe("Dropbox (top level)");
    expect(formatFolderPath("/Photos")).toBe("/Photos");
  });
});

describe("getBreadcrumbs", () => {
  it("starts at the Dropbox root", () => {
    expect(getBreadcrumbs("/")).toEqual([{ label: "Dropbox", path: "/" }]);
  });

  it("builds a crumb for every folder in the path", () => {
    expect(getBreadcrumbs("/Photos/2026")).toEqual([
      { label: "Dropbox", path: "/" },
      { label: "Photos", path: "/Photos" },
      { label: "2026", path: "/Photos/2026" },
    ]);
  });
});

describe("isSameFolder", () => {
  it("ignores case and trailing slashes, like Dropbox paths", () => {
    expect(isSameFolder("/Photos/2026/", "/photos/2026")).toBe(true);
  });

  it("treats missing values as different", () => {
    expect(isSameFolder(null, "/")).toBe(false);
    expect(isSameFolder("/A", "/B")).toBe(false);
  });
});
