import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./time";

const NOW = new Date("2026-10-11T12:00:00Z").getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [30_000, "just now"],
    [5 * MINUTE, "5 min ago"],
    [3 * HOUR, "3 hr ago"],
    [30 * HOUR, "yesterday"],
    [4 * DAY, "4 days ago"],
  ])("formats %i ms ago as %s", (elapsed, expected) => {
    expect(formatRelativeTime(NOW - elapsed, NOW)).toBe(expected);
  });

  it("treats future timestamps as just now", () => {
    expect(formatRelativeTime(NOW + MINUTE, NOW)).toBe("just now");
  });

  it("falls back to a calendar date after a week", () => {
    const timestamp = NOW - 10 * DAY;
    expect(formatRelativeTime(timestamp, NOW)).toBe(
      new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
  });
});
