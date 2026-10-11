export type SetupStepNumber = 1 | 2 | 3 | 4 | 5;

export interface SetupErrorHint {
  step: SetupStepNumber | null;
  hint: string;
}

const APP_KEY_PATTERN = /^[a-z0-9]{10,20}$/;

export function isLikelyAppKey(value: string): boolean {
  return APP_KEY_PATTERN.test(value.trim());
}

export function maskAppKey(appKey: string): string {
  if (appKey.length <= 6) return "•".repeat(appKey.length);
  return `${appKey.slice(0, 3)}…${appKey.slice(-3)}`;
}

export function getSetupErrorHint(message: string): SetupErrorHint {
  if (/redirect[_ ]?ur[il]/i.test(message)) {
    return {
      step: 3,
      hint: "Dropbox did not accept the redirect URI. Check step 3: the URI in your Dropbox app must match exactly.",
    };
  }
  if (/client_id|invalid_client|app key|app not found/i.test(message)) {
    return {
      step: 4,
      hint: "Dropbox did not recognise the app key. Check step 4: copy the App key (not the App secret) again.",
    };
  }
  if (/scope|permission/i.test(message)) {
    return {
      step: 2,
      hint: "Your Dropbox app is missing a permission. Check step 2, tick all four scopes, and click Submit.",
    };
  }
  if (/could not be loaded/i.test(message)) {
    return {
      step: 3,
      hint: "The Dropbox sign-in page could not load. Check your connection, then recheck steps 3 and 4.",
    };
  }
  if (/did not approve|cancel|closed|did not complete/i.test(message)) {
    return {
      step: null,
      hint:
        "The Dropbox window closed before you clicked Allow. Try again. If Dropbox showed an error page, recheck steps 2 to 4.",
    };
  }
  return {
    step: null,
    hint: "Recheck steps 2 to 4, then try connecting again.",
  };
}
