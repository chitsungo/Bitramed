import type { AccessStatus, LearnerPreferences } from "../types/learner";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function boolean(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (source[key] !== null && source[key] !== undefined) {
      return source[key] === true;
    }
  }
  return false;
}

export const defaultPreferences: LearnerPreferences = {
  theme: "system",
  textSize: "normal",
  reducedMotion: false,
  defaultMode: "study",
  defaultDurationMinutes: null,
  defaultNegativeMarking: false,
};

export function normalizeAccess(value: unknown): AccessStatus {
  const source = record(value);
  const raw = text(source, "status");
  let status = [
    "active",
    "expiring",
    "owner",
    "expired",
    "blocked",
    "no_access",
    "signed_out",
  ].includes(raw)
    ? (raw as AccessStatus["status"])
    : "no_access";
  const accessExpiresAt =
    text(source, "accessExpiresAt", "access_expires_at") || null;
  if (status === "active" && accessExpiresAt) {
    const remaining = Date.parse(accessExpiresAt) - Date.now();
    if (remaining >= 0 && remaining <= 7 * 86_400_000) status = "expiring";
  }
  return {
    status,
    hasAccess:
      boolean(source, "hasAccess", "has_access") ||
      status === "active" ||
      status === "expiring" ||
      status === "owner",
    accessStartsAt: text(source, "accessStartsAt", "access_starts_at") || null,
    accessExpiresAt,
    blockReason: text(source, "blockReason", "block_reason"),
  };
}

export function normalizePreferences(value: unknown): LearnerPreferences {
  const source = record(value);
  const theme = text(source, "theme", "themePreference");
  const textSize = text(source, "textSize", "text_size");
  const mode = text(source, "defaultMode", "default_mode");
  const durationValue =
    source.defaultDurationMinutes ?? source.default_duration_minutes;
  const duration =
    durationValue === null || durationValue === undefined
      ? null
      : Number(durationValue);
  return {
    theme: ["system", "light", "dark"].includes(theme)
      ? (theme as LearnerPreferences["theme"])
      : defaultPreferences.theme,
    textSize: textSize === "large" ? "large" : "normal",
    reducedMotion: boolean(source, "reducedMotion", "reduced_motion"),
    defaultMode: mode === "exam" ? "exam" : "study",
    defaultDurationMinutes:
      duration && [5, 10, 15, 20, 30, 45, 60].includes(duration)
        ? duration
        : null,
    defaultNegativeMarking: boolean(
      source,
      "defaultNegativeMarking",
      "default_negative_marking"
    ),
  };
}
