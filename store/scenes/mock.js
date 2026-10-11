// Stands in for the background script so extension pages render with sample data.
// Pick the state with ?scene=scan|single|popup|setup on the extension page URL.
(function () {
  const scene = new URLSearchParams(location.search).get("scene") || "popup";
  const art = (file) => `http://images.wanderlust.example/photos/${file}`;
  const pageUrl = "https://wanderlust.example/iceland-photo-diary";
  const now = Date.now();

  const photo = (file, width, height) => ({
    sourceUrl: art(file),
    pageUrl,
    detectedType: "image",
    suggestedFilename: null,
    requiresAuthenticatedFetch: false,
    triggerKind: "scan",
    width,
    height,
  });

  const scanAssets = [
    {
      sourceUrl: "http://media.wanderlust.example/video/glacier-walk.mp4",
      pageUrl,
      detectedType: "video",
      suggestedFilename: "glacier-walk.mp4",
      requiresAuthenticatedFetch: false,
      triggerKind: "scan",
      width: 1920,
      height: 1080,
    },
    {
      sourceUrl: "http://wanderlust.example/downloads/iceland-itinerary.pdf",
      pageUrl,
      detectedType: "link",
      suggestedFilename: "iceland-itinerary.pdf",
      requiresAuthenticatedFetch: false,
      triggerKind: "scan",
    },
    photo("glacier-lagoon.jpg", 2400, 1500),
    photo("northern-lights.jpg", 2100, 1350),
    photo("black-sand-beach.jpg", 1800, 1200),
    photo("waterfall.jpg", 1200, 1600),
    photo("author.svg", 64, 64),
  ];

  const settings = {
    appKey: scene === "setup" ? null : "k7x2m9q4w1p8z5c",
    lastUsedFolderPath: "/Photos/Iceland 2026",
    savePreferences: {
      saveMode: scene === "single" ? "reviewed" : "one_click",
      promptForRename: scene === "single",
      folderBehavior: "remember_last",
    },
    saveModeSetByUser: true,
  };

  const authState =
    scene === "setup"
      ? { status: "missing_app_key", appKey: null, redirectUri: "https://abcdefghijklmnop.chromiumapp.org/dropbox" }
      : {
          status: "signed_in",
          appKey: settings.appKey,
          accountEmail: "alex@example.com",
          redirectUri: "https://abcdefghijklmnop.chromiumapp.org/dropbox",
        };

  const folders = {
    "/": ["Camera Uploads", "Documents", "Photos", "Web Saves"],
    "/photos": ["Iceland 2026", "Lisbon 2025", "Wallpapers"],
    "/photos/iceland 2026": ["Day 1 - Reykjavik", "Day 2 - Glacier lagoon", "Day 3 - South coast"],
  };

  function listFolders(path) {
    const base = path === "/" ? "" : path;
    return (folders[path.toLowerCase()] || []).map((name) => ({
      id: `id:${base}/${name}`,
      name,
      pathLower: `${base}/${name}`.toLowerCase(),
      pathDisplay: `${base}/${name}`,
    }));
  }

  const minutesAgo = (minutes) => now - minutes * 60_000;
  const recentSaves = [
    ["glacier-lagoon.jpg", "wanderlust.example", "/Photos/Iceland 2026", 2],
    ["iceland-itinerary.pdf", "wanderlust.example", "/Photos/Iceland 2026", 3],
    ["quarterly-report.pdf", "investors.example.com", "/Documents", 95],
    ["mountain-wallpaper.png", "unsplash.com", "/Photos/Wallpapers", 1440],
  ].map(([filename, sourceDomain, destinationPath, minutes], index) => ({
    id: String(index),
    filename,
    sourceDomain,
    destinationPath,
    success: true,
    timestamp: minutesAgo(minutes),
    method: "url_import",
    message: `Saved ${filename}.`,
  }));

  const singleCandidate = photo("glacier-lagoon.jpg", 2400, 1500);
  singleCandidate.triggerKind = "image";

  const pendingSave =
    scene === "scan"
      ? { mode: "scan", assets: scanAssets, tabId: 1, destinationPath: null, createdAt: now, reason: "scan" }
      : scene === "single"
        ? {
            mode: "single",
            request: { candidate: singleCandidate, destinationPath: "/Photos/Iceland 2026", forceFolderPicker: true },
            resolvedFilename: "glacier-lagoon.jpg",
            createdAt: now,
            reason: "context_review",
          }
        : null;

  const responses = {
    GET_AUTH_STATE: authState,
    GET_SETTINGS: settings,
    SAVE_SETTINGS: settings,
    GET_PENDING_SAVE: pendingSave,
    GET_RECENT_SAVES: recentSaves,
  };

  const storageData = {
    setupProgress: { createdApp: true, enabledScopes: true, addedRedirectUri: false },
  };
  const noopEvent = { addListener() {}, removeListener() {} };

  window.chrome = {
    runtime: {
      id: "abcdefghijklmnop",
      getURL: (path) => `/${path}`,
      getManifest: () => ({ version: "0.1.0" }),
      onMessage: noopEvent,
      sendMessage: async (message) => {
        if (message.type === "LIST_FOLDERS") return listFolders(message.path);
        return responses[message.type] ?? null;
      },
    },
    storage: {
      onChanged: noopEvent,
      local: {
        get: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((key) => key in storageData).map((key) => [key, storageData[key]]));
        },
        set: async () => undefined,
      },
    },
    tabs: { create: async () => undefined, query: async () => [] },
  };
})();
