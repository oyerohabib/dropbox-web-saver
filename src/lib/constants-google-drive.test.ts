import { describe, expect, it } from "vitest";
import { GOOGLE_DRIVE_FULL_SCOPE, googleDriveCanListExistingFolders } from "./constants";

describe("googleDriveCanListExistingFolders", () => {
  it("is false for missing or drive.file-only tokens", () => {
    expect(googleDriveCanListExistingFolders(undefined)).toBe(false);
    expect(googleDriveCanListExistingFolders("")).toBe(false);
    expect(
      googleDriveCanListExistingFolders(
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      ),
    ).toBe(false);
  });

  it("is true when the full Drive scope is granted", () => {
    expect(
      googleDriveCanListExistingFolders(
        `${GOOGLE_DRIVE_FULL_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
      ),
    ).toBe(true);
  });
});
