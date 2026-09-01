import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  normalizeAccess,
  normalizePreferences,
} from "./learner-normalizers";
import {
  parseBooleanParam,
  parseDurationParam,
  parseQuizMode,
} from "./learner-query";

describe("learner API contracts", () => {
  it("treats owner access as active without an expiry", () => {
    expect(
      normalizeAccess({
        status: "owner",
        hasAccess: true,
        accessStartsAt: null,
        accessExpiresAt: null,
      })
    ).toEqual({
      status: "owner",
      hasAccess: true,
      accessStartsAt: null,
      accessExpiresAt: null,
      blockReason: "",
    });
  });

  it("derives expiring access inside the seven-day warning window", () => {
    const accessExpiresAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    expect(
      normalizeAccess({
        status: "active",
        hasAccess: true,
        accessExpiresAt,
      })
    ).toMatchObject({
      status: "expiring",
      hasAccess: true,
      accessExpiresAt,
    });
  });

  it("normalizes the complete preference model", () => {
    expect(
      normalizePreferences({
        theme: "dark",
        textSize: "large",
        reducedMotion: true,
        defaultMode: "exam",
        defaultDurationMinutes: 30,
        defaultNegativeMarking: true,
      })
    ).toEqual({
      theme: "dark",
      textSize: "large",
      reducedMotion: true,
      defaultMode: "exam",
      defaultDurationMinutes: 30,
      defaultNegativeMarking: true,
    });
  });

  it("rejects unsupported preference values", () => {
    expect(
      normalizePreferences({
        theme: "sepia",
        textSize: "huge",
        defaultMode: "practice",
        defaultDurationMinutes: 12,
      })
    ).toEqual(defaultPreferences);
  });

  it("rejects malformed assessment query settings", () => {
    expect(parseDurationParam("30")).toEqual({ value: 30, valid: true });
    expect(parseDurationParam("12")).toEqual({ value: null, valid: false });
    expect(parseBooleanParam("2")).toEqual({ value: false, valid: false });
    expect(parseQuizMode("practice")).toEqual({
      value: "study",
      valid: false,
    });
  });
});
