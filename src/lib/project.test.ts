import { describe, expect, it } from "vitest";
import {
  buildFeedbackEmail,
  buildIssueUrl,
  CONTACT_EMAIL,
  describeBrowser,
  type FeedbackInput,
  isFeedbackKind,
  MAX_ISSUE_DESCRIPTION_LENGTH,
  truncateDescription,
  UNINSTALL_FEEDBACK_URL,
} from "./project";

const baseInput: FeedbackInput = {
  kind: "bug",
  title: "Save failed",
  description: "It said: Dropbox returned 409 & stopped",
  includeDiagnostics: true,
  diagnostics: { version: "0.1.0", browser: "Chrome 141 on macOS", connected: true },
};

function params(url: string) {
  return new URL(url).searchParams;
}

describe("buildIssueUrl", () => {
  it.each([
    ["bug", "bug_report.yml", "[Bug]: Save failed"],
    ["feature", "feature_request.yml", "[Feature]: Save failed"],
    ["feedback", "feedback.yml", "[Feedback]: Save failed"],
  ] as const)("uses the %s template and title prefix", (kind, template, title) => {
    const search = params(buildIssueUrl({ ...baseInput, kind }));
    expect(search.get("template")).toBe(template);
    expect(search.get("title")).toBe(title);
  });

  it("targets the repository's new issue page and encodes the description", () => {
    const url = buildIssueUrl(baseInput);
    expect(url.startsWith("https://github.com/oyerohabib/dropbox-web-saver/issues/new?")).toBe(true);
    expect(url).not.toContain(" & ");
    expect(params(url).get("description")).toBe(baseInput.description);
  });

  it("includes version and environment when diagnostics are shared", () => {
    const search = params(buildIssueUrl(baseInput));
    expect(search.get("version")).toBe("0.1.0");
    expect(search.get("browser")).toBe("Chrome 141 on macOS · Dropbox connected");
  });

  it("leaves diagnostics out when the user opts out", () => {
    const search = params(buildIssueUrl({ ...baseInput, includeDiagnostics: false }));
    expect(search.has("version")).toBe(false);
    expect(search.has("browser")).toBe(false);
  });

  it("leaves diagnostics out for feature ideas", () => {
    expect(params(buildIssueUrl({ ...baseInput, kind: "feature" })).has("version")).toBe(false);
  });

  it("omits empty title and description", () => {
    const search = params(buildIssueUrl({ ...baseInput, title: "  ", description: "" }));
    expect(search.has("title")).toBe(false);
    expect(search.has("description")).toBe(false);
  });

  it("shortens very long descriptions", () => {
    const search = params(buildIssueUrl({ ...baseInput, description: "x".repeat(10_000) }));
    expect(search.get("description")!.length).toBeLessThanOrEqual(MAX_ISSUE_DESCRIPTION_LENGTH);
  });
});

describe("buildFeedbackEmail", () => {
  it("addresses the developer with a labelled subject and encoded body", () => {
    const mailto = buildFeedbackEmail(baseInput);
    expect(mailto.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
    expect(mailto).not.toContain("+");

    const search = new URLSearchParams(mailto.split("?")[1]);
    expect(search.get("subject")).toBe("[Web Saver] Bug report: Save failed");
    expect(search.get("body")).toContain(baseInput.description);
    expect(search.get("body")).toContain("Extension version: 0.1.0");
  });

  it("leaves diagnostics out of the body when the user opts out", () => {
    const search = new URLSearchParams(buildFeedbackEmail({ ...baseInput, includeDiagnostics: false }).split("?")[1]);
    expect(search.get("body")).not.toContain("Extension version");
  });
});

describe("truncateDescription", () => {
  it("keeps short text unchanged apart from trimming", () => {
    expect(truncateDescription("  hello \n", 100)).toBe("hello");
  });

  it("cuts long text to the limit and adds a note", () => {
    const result = truncateDescription("word ".repeat(500), 200);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toMatch(/Shortened/);
  });
});

describe("describeBrowser", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome 141 on macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge 141 on Windows",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", "Chrome 140 on Linux"],
    ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0", "Chrome 141 on ChromeOS"],
  ])("describes %j", (userAgent, expected) => {
    expect(describeBrowser(userAgent)).toBe(expected);
  });
});

describe("isFeedbackKind", () => {
  it("accepts known kinds only", () => {
    expect(isFeedbackKind("bug")).toBe(true);
    expect(isFeedbackKind("toString")).toBe(false);
    expect(isFeedbackKind(null)).toBe(false);
  });
});

describe("UNINSTALL_FEEDBACK_URL", () => {
  it("opens the feedback form with an uninstall title", () => {
    const search = params(UNINSTALL_FEEDBACK_URL);
    expect(search.get("template")).toBe("feedback.yml");
    expect(search.get("title")).toBe("[Feedback]: Uninstall feedback");
  });
});
