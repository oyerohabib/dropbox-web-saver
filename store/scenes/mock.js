// Stands in for the background script so extension pages render with sample data.
// Pick the state with ?scene=scan|single|popup|setup on the extension page URL.
(function () {
  const scene = new URLSearchParams(location.search).get("scene") || "popup";
  const art = (file) => `http://images.wanderlust.example/photos/${file}`;
  const pageUrl = "https://wanderlust.example/iceland-photo-diary";
  const now = Date.now();
  const dropboxRedirect = "https://abcdefghijklmnop.chromiumapp.org/dropbox";
  const driveRedirect = "https://abcdefghijklmnop.chromiumapp.org/";

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
    appKey: null,
    lastUsedFolderPath: "/Photos/Iceland 2026",
    lastUsedFolders: {
      dropbox: "/Photos/Iceland 2026",
      google_drive: "id:drive:iceland-2026",
    },
    lastUsedFolderLabels: {
      dropbox: "/Photos/Iceland 2026",
      google_drive: "Iceland 2026",
    },
    lastUsedProvider: "dropbox",
    savePreferences: {
      saveMode: scene === "single" ? "reviewed" : "one_click",
      promptForRename: scene === "single",
      folderBehavior: "remember_last",
    },
    saveModeSetByUser: true,
    walkthroughHidden: true,
  };

  const signedOut = scene === "setup";
  const dropboxAuth = signedOut
    ? { status: "signed_out", appKey: null, appKeySource: "builtin", redirectUri: dropboxRedirect }
    : {
        status: "signed_in",
        appKey: null,
        appKeySource: "builtin",
        accountEmail: "alex@example.com",
        redirectUri: dropboxRedirect,
      };
  const googleDriveAuth = signedOut
    ? { status: "signed_out", clientId: "mock-google-client-id", redirectUri: driveRedirect }
    : {
        status: "signed_in",
        clientId: "mock-google-client-id",
        accountEmail: "alex.j@gmail.com",
        redirectUri: driveRedirect,
      };
  const combinedAuth = { dropbox: dropboxAuth, googleDrive: googleDriveAuth };

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

  const driveFolders = {
    root: [
      ["id:drive:photos", "Photos"],
      ["id:drive:documents", "Documents"],
      ["id:drive:web-saves", "Web Saves"],
    ],
    "id:drive:photos": [
      ["id:drive:iceland-2026", "Iceland 2026"],
      ["id:drive:lisbon-2025", "Lisbon 2025"],
      ["id:drive:wallpapers", "Wallpapers"],
    ],
    "id:drive:iceland-2026": [
      ["id:drive:day-1", "Day 1 - Reykjavik"],
      ["id:drive:day-2", "Day 2 - Glacier lagoon"],
      ["id:drive:day-3", "Day 3 - South coast"],
    ],
  };
  const driveFolderNames = {
    root: "My Drive (top level)",
    "id:drive:photos": "Photos",
    "id:drive:documents": "Documents",
    "id:drive:web-saves": "Web Saves",
    "id:drive:iceland-2026": "Iceland 2026",
    "id:drive:lisbon-2025": "Lisbon 2025",
    "id:drive:wallpapers": "Wallpapers",
    "id:drive:day-1": "Day 1 - Reykjavik",
    "id:drive:day-2": "Day 2 - Glacier lagoon",
    "id:drive:day-3": "Day 3 - South coast",
  };

  function listDriveFolders(path) {
    const key = path || "root";
    return (driveFolders[key] || []).map(([id, name]) => ({
      id,
      name,
      pathLower: name.toLowerCase(),
      pathDisplay: name,
      parentKey: key,
    }));
  }

  const minutesAgo = (minutes) => now - minutes * 60_000;
  const recentSaves = [
    ["glacier-lagoon.jpg", "wanderlust.example", "/Photos/Iceland 2026", "/Photos/Iceland 2026", "dropbox", 2],
    ["iceland-itinerary.pdf", "wanderlust.example", "id:drive:iceland-2026", "Iceland 2026", "google_drive", 3],
    ["quarterly-report.pdf", "investors.example.com", "/Documents", "/Documents", "dropbox", 95],
    ["mountain-wallpaper.png", "unsplash.com", "id:drive:wallpapers", "Wallpapers", "google_drive", 1440],
  ]
    .slice(0, scene === "popup" ? 2 : 4)
    .map(([filename, sourceDomain, destinationPath, destinationLabel, provider, minutes], index) => ({
      id: String(index),
      filename,
      sourceDomain,
      destinationPath,
      destinationLabel,
      provider,
      success: true,
      timestamp: minutesAgo(minutes),
      method: "url_import",
      message: `Saved ${filename}.`,
    }));

  const singleCandidate = photo("glacier-lagoon.jpg", 2400, 1500);
  singleCandidate.triggerKind = "image";

  const pendingSave =
    scene === "scan"
      ? {
          mode: "scan",
          assets: scanAssets,
          tabId: 1,
          destinationPath: "/Photos/Iceland 2026",
          destinations: {
            dropbox: "/Photos/Iceland 2026",
            google_drive: "id:drive:iceland-2026",
          },
          selectedProviders: ["dropbox", "google_drive"],
          createdAt: now,
          reason: "scan",
        }
      : scene === "single"
        ? {
            mode: "single",
            request: {
              candidate: singleCandidate,
              provider: "dropbox",
              destinationPath: "/Photos/Iceland 2026",
              forceFolderPicker: true,
            },
            resolvedFilename: "glacier-lagoon.jpg",
            createdAt: now,
            reason: "context_review",
          }
        : null;

  const responses = {
    GET_AUTH_STATE: dropboxAuth,
    GET_GOOGLE_AUTH_STATE: googleDriveAuth,
    GET_COMBINED_AUTH_STATE: combinedAuth,
    GET_SETTINGS: settings,
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
      getManifest: () => ({ version: "0.4.0" }),
      onMessage: noopEvent,
      sendMessage: async (message) => {
        if (message.type === "LIST_FOLDERS") {
          return message.provider === "google_drive" ? listDriveFolders(message.path) : listFolders(message.path);
        }
        if (message.type === "RESOLVE_FOLDER_LABEL") {
          if (message.provider === "google_drive") {
            return driveFolderNames[message.path] ?? "My Drive (top level)";
          }
          return message.path || "Dropbox (top level)";
        }
        if (message.type === "SAVE_SETTINGS") {
          if (message.settings.savePreferences) {
            settings.savePreferences = { ...settings.savePreferences, ...message.settings.savePreferences };
          }
          Object.assign(settings, message.settings, { savePreferences: settings.savePreferences });
          return settings;
        }
        if (message.type === "SET_LAST_USED_FOLDER") {
          const provider = message.provider ?? "dropbox";
          settings.lastUsedFolders[provider] = message.path;
          if (message.label) settings.lastUsedFolderLabels[provider] = message.label;
          settings.lastUsedProvider = provider;
          if (provider === "dropbox") settings.lastUsedFolderPath = message.path;
          return settings;
        }
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
