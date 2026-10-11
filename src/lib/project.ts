export const REPO_URL = "https://github.com/oyerohabib/dropbox-web-saver";
export const ISSUES_URL = `${REPO_URL}/issues`;
export const NEW_ISSUE_URL = `${ISSUES_URL}/new/choose`;
export const CONTACT_EMAIL = "oyerohabib@yahoo.com";

export type FeedbackKind = "bug" | "feature" | "feedback";

export interface FeedbackDiagnostics {
  version: string;
  browser: string;
  connected: boolean;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  title: string;
  description: string;
  includeDiagnostics: boolean;
  diagnostics: FeedbackDiagnostics;
}

interface FeedbackKindConfig {
  label: string;
  template: string;
  titlePrefix: string;
  acceptsDiagnostics: boolean;
}

// Template file names and field ids must match .github/ISSUE_TEMPLATE/*.yml.
export const FEEDBACK_KINDS: Record<FeedbackKind, FeedbackKindConfig> = {
  bug: { label: "Bug report", template: "bug_report.yml", titlePrefix: "[Bug]: ", acceptsDiagnostics: true },
  feature: { label: "Feature idea", template: "feature_request.yml", titlePrefix: "[Feature]: ", acceptsDiagnostics: false },
  feedback: { label: "Feedback", template: "feedback.yml", titlePrefix: "[Feedback]: ", acceptsDiagnostics: true },
};

// GitHub rejects very long issue URLs and many mail apps cap mailto links around 2,000 characters.
export const MAX_ISSUE_DESCRIPTION_LENGTH = 3000;
export const MAX_EMAIL_DESCRIPTION_LENGTH = 1500;
const TRUNCATION_NOTE = "\n\n[Shortened to fit in a link. Add the rest here.]";

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && Object.hasOwn(FEEDBACK_KINDS, value);
}

export function truncateDescription(text: string, maxLength: number) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - TRUNCATION_NOTE.length).trimEnd()}${TRUNCATION_NOTE}`;
}

export function describeBrowser(userAgent: string) {
  const browser =
    matchVersion(userAgent, "Edg", "Edge") ??
    matchVersion(userAgent, "OPR", "Opera") ??
    matchVersion(userAgent, "Chrome", "Chrome") ??
    "Unknown browser";

  const os = /CrOS/.test(userAgent)
    ? "ChromeOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "unknown OS";

  return `${browser} on ${os}`;
}

function matchVersion(userAgent: string, token: string, name: string) {
  const match = userAgent.match(new RegExp(`${token}/(\\d+)`));
  return match ? `${name} ${match[1]}` : null;
}

export function formatEnvironment(diagnostics: FeedbackDiagnostics) {
  return `${diagnostics.browser} · Dropbox ${diagnostics.connected ? "connected" : "not connected"}`;
}

export function sharesDiagnostics(input: Pick<FeedbackInput, "kind" | "includeDiagnostics">) {
  return input.includeDiagnostics && FEEDBACK_KINDS[input.kind].acceptsDiagnostics;
}

export function buildIssueUrl(input: FeedbackInput) {
  const config = FEEDBACK_KINDS[input.kind];
  const url = new URL(`${ISSUES_URL}/new`);
  url.searchParams.set("template", config.template);

  const title = input.title.trim();
  if (title) {
    url.searchParams.set("title", `${config.titlePrefix}${title}`);
  }

  const description = truncateDescription(input.description, MAX_ISSUE_DESCRIPTION_LENGTH);
  if (description) {
    url.searchParams.set("description", description);
  }

  if (sharesDiagnostics(input)) {
    url.searchParams.set("version", input.diagnostics.version);
    url.searchParams.set("browser", formatEnvironment(input.diagnostics));
  }

  return url.toString();
}

export function buildFeedbackEmail(input: FeedbackInput) {
  const config = FEEDBACK_KINDS[input.kind];
  const title = input.title.trim();
  const subject = `[Web Saver] ${config.label}${title ? `: ${title}` : ""}`;

  const lines = [truncateDescription(input.description, MAX_EMAIL_DESCRIPTION_LENGTH) || "(Write your message here)"];
  if (sharesDiagnostics(input)) {
    lines.push(
      "",
      "---",
      `Extension version: ${input.diagnostics.version}`,
      `Browser and environment: ${formatEnvironment(input.diagnostics)}`,
    );
  }

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export const UNINSTALL_FEEDBACK_URL = (() => {
  const url = new URL(`${ISSUES_URL}/new`);
  url.searchParams.set("template", FEEDBACK_KINDS.feedback.template);
  url.searchParams.set("title", `${FEEDBACK_KINDS.feedback.titlePrefix}Uninstall feedback`);
  return url.toString();
})();
