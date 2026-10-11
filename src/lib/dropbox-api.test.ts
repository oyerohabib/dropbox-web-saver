import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkDropboxResponse } from "./dropbox-api";
import { setTokens } from "./storage";

vi.mock("./dropbox-auth", () => ({
  getValidAccessToken: vi.fn(),
  setAccountEmail: vi.fn(),
}));

vi.mock("./storage", () => ({
  setTokens: vi.fn(),
}));

function dropboxError(status: number, errorSummary: string): Response {
  return new Response(JSON.stringify({ error_summary: errorSummary }), { status });
}

describe("checkDropboxResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes successful responses through", async () => {
    await expect(checkDropboxResponse(new Response("{}", { status: 200 }))).resolves.toBeUndefined();
  });

  it("clears tokens and reports TOKEN_EXPIRED on 401", async () => {
    await expect(
      checkDropboxResponse(dropboxError(401, "invalid_access_token/.."), "UPLOAD_FAILED"),
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(setTokens).toHaveBeenCalledWith(null);
  });

  it("maps missing paths to FOLDER_NOT_FOUND with a readable message", async () => {
    await expect(
      checkDropboxResponse(dropboxError(409, "path/not_found/..")),
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
      message: "That Dropbox folder no longer exists. Choose another folder.",
    });
  });

  it("maps a full Dropbox to a readable upload failure", async () => {
    await expect(
      checkDropboxResponse(dropboxError(409, "path/insufficient_space/.."), "UPLOAD_FAILED"),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED", message: expect.stringContaining("full") });
  });

  it("falls back to the provided error code with the Dropbox summary", async () => {
    await expect(
      checkDropboxResponse(dropboxError(409, "path/disallowed_name/.."), "UPLOAD_FAILED"),
    ).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Dropbox request failed (409): path/disallowed_name/..",
    });
  });
});
