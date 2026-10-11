import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAsset } from "./save-orchestrator";
import { getAuthState } from "./dropbox-auth";
import { getCurrentAccount, saveUrlToDropbox, uploadFileToDropbox } from "./dropbox-api";

vi.mock("./dropbox-auth", () => ({
  getAuthState: vi.fn(),
}));

vi.mock("./dropbox-api", () => ({
  getCurrentAccount: vi.fn(),
  saveUrlToDropbox: vi.fn(),
  uploadFileToDropbox: vi.fn(),
  createFolder: vi.fn(),
}));

vi.mock("./storage", () => ({
  appendRecentSave: vi.fn(),
  setLastResult: vi.fn(),
  setPendingSave: vi.fn(),
  updateSettings: vi.fn(),
}));

describe("saveAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses Dropbox url import when the candidate is a public asset", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });
    vi.mocked(saveUrlToDropbox).mockResolvedValue({ pathDisplay: "/Designs/mockup.png" });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://cdn.example.com/mockup.png",
          pageUrl: "https://example.com/project",
          detectedType: "image",
          suggestedFilename: "mockup.png",
          requiresAuthenticatedFetch: false,
        },
        destinationPath: "/Designs",
      },
      {
        fetchAssetBytes: vi.fn(),
        now: () => 1,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.method).toBe("url_import");
  });

  it("accepts extensionless image URLs when the trigger context identifies them as images", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });
    vi.mocked(saveUrlToDropbox).mockResolvedValue({
      pathDisplay: "/Designs/photo-1773332585698-cba3c91b73e4.jpg",
    });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl:
            "https://images.unsplash.com/photo-1773332585698-cba3c91b73e4?w=900&auto=format&fit=crop&q=60",
          pageUrl: "https://unsplash.com/photos/example",
          detectedType: "image",
          suggestedFilename: null,
          requiresAuthenticatedFetch: false,
        },
        destinationPath: "/Designs",
      },
      {
        fetchAssetBytes: vi.fn(),
        now: () => 7,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.method).toBe("url_import");
  });

  it("probes extensionless URLs so the saved name gets a real extension", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(saveUrlToDropbox).mockResolvedValue({ pathDisplay: "/Designs/photo-abc.jpg" });
    const probeAssetMetadata = vi.fn().mockResolvedValue({
      contentType: "image/jpeg",
      contentDispositionFilename: null,
    });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://images.unsplash.com/photo-abc?w=900&auto=format",
          pageUrl: "https://unsplash.com/photos/example",
          detectedType: "image",
          suggestedFilename: null,
          requiresAuthenticatedFetch: false,
          triggerKind: "scan",
        },
        destinationPath: "/Designs",
      },
      { fetchAssetBytes: vi.fn(), probeAssetMetadata, now: () => 9 },
    );

    expect(probeAssetMetadata).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.filename).toBe("photo-abc.jpg");
    expect(saveUrlToDropbox).toHaveBeenCalledWith(
      "/Designs/photo-abc.jpg",
      "https://images.unsplash.com/photo-abc?w=900&auto=format",
    );
  });

  it("skips the metadata probe when the filename already has an extension", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(saveUrlToDropbox).mockResolvedValue({ pathDisplay: "/Designs/mockup.png" });
    const probeAssetMetadata = vi.fn();

    await saveAsset(
      {
        candidate: {
          sourceUrl: "https://cdn.example.com/mockup.png",
          pageUrl: "https://example.com/project",
          detectedType: "image",
          suggestedFilename: null,
          requiresAuthenticatedFetch: false,
        },
        destinationPath: "/Designs",
      },
      { fetchAssetBytes: vi.fn(), probeAssetMetadata, now: () => 10 },
    );

    expect(probeAssetMetadata).not.toHaveBeenCalled();
  });

  it("falls back to direct upload when url import is not allowed", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });
    vi.mocked(uploadFileToDropbox).mockResolvedValue({ pathDisplay: "/Designs/private.png" });

    const fetchAssetBytes = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "image/png",
      arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
    });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://app.example.com/private.png",
          pageUrl: "https://app.example.com/work",
          detectedType: "image",
          suggestedFilename: "private.png",
          requiresAuthenticatedFetch: true,
        },
        destinationPath: "/Designs",
        tabId: 12,
      },
      {
        fetchAssetBytes,
        now: () => 2,
      },
    );

    expect(fetchAssetBytes).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.method).toBe("direct_upload");
  });

  it("fails cleanly instead of uploading when the fetched payload has no real bytes", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });

    for (const arrayBuffer of [{} as ArrayBuffer, new ArrayBuffer(0)]) {
      const result = await saveAsset(
        {
          candidate: {
            sourceUrl: "https://app.example.com/private.png",
            pageUrl: "https://app.example.com/work",
            detectedType: "image",
            suggestedFilename: "private.png",
            requiresAuthenticatedFetch: true,
          },
          destinationPath: "/Designs",
          tabId: 12,
        },
        {
          fetchAssetBytes: vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            contentType: "image/png",
            arrayBuffer,
          }),
          now: () => 8,
        },
      );

      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("ASSET_FETCH_FAILED");
    }
    expect(uploadFileToDropbox).not.toHaveBeenCalled();
  });

  it("prefers a user-edited final filename when provided", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });
    vi.mocked(uploadFileToDropbox).mockResolvedValue({ pathDisplay: "/Designs/renamed-asset.png" });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://cdn.example.com/original.png",
          pageUrl: "https://example.com/project",
          detectedType: "image",
          suggestedFilename: "original.png",
          requiresAuthenticatedFetch: true,
        },
        destinationPath: "/Designs",
        finalFilename: "renamed-asset.png",
      },
      {
        fetchAssetBytes: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          contentType: "image/png",
          arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
        }),
        now: () => 3,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.filename).toBe("renamed-asset.png");
    expect(uploadFileToDropbox).toHaveBeenCalledWith(
      "/Designs/renamed-asset.png",
      expect.any(ArrayBuffer),
    );
  });

  it("returns a folder-required response when no folder is available", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://cdn.example.com/mockup.png",
          pageUrl: "https://example.com/project",
          detectedType: "image",
          suggestedFilename: "mockup.png",
          requiresAuthenticatedFetch: false,
        },
      },
      {
        fetchAssetBytes: vi.fn(),
        now: () => 4,
      },
    );

    expect(result.status).toBe("needs_folder");
  });

  it("rejects unsupported targets before attempting upload", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_in",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });
    vi.mocked(getCurrentAccount).mockResolvedValue({ email: "designer@example.com" });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://example.com/article/about-us",
          pageUrl: "https://example.com/article/about-us",
          detectedType: "unknown",
          suggestedFilename: null,
          requiresAuthenticatedFetch: false,
        },
        destinationPath: "/Designs",
      },
      {
        fetchAssetBytes: vi.fn(),
        now: () => 5,
      },
    );

    expect(result.status).toBe("unsupported");
    expect(result.errorCode).toBe("UNSUPPORTED_TARGET");
  });

  it("returns an auth-required response when Dropbox is not connected", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "signed_out",
      appKey: "app-key",
      redirectUri: "https://example.test",
    });

    const result = await saveAsset(
      {
        candidate: {
          sourceUrl: "https://cdn.example.com/mockup.png",
          pageUrl: "https://example.com/project",
          detectedType: "image",
          suggestedFilename: "mockup.png",
          requiresAuthenticatedFetch: false,
        },
        destinationPath: "/Designs",
      },
      {
        fetchAssetBytes: vi.fn(),
        now: () => 6,
      },
    );

    expect(result.status).toBe("needs_auth");
  });
});
