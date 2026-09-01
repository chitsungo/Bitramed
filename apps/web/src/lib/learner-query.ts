export const ASSESSMENT_DURATIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export function parseDurationParam(value: string | null) {
  const normalized = value?.trim() || "";
  if (!normalized) return { value: null, valid: true } as const;
  if (!/^\d+$/.test(normalized)) return { value: null, valid: false } as const;
  const duration = Number(normalized);
  return ASSESSMENT_DURATIONS.includes(
    duration as (typeof ASSESSMENT_DURATIONS)[number]
  )
    ? ({ value: duration, valid: true } as const)
    : ({ value: null, valid: false } as const);
}

export function parseBooleanParam(value: string | null) {
  if (value === null || value === "" || value === "0") {
    return { value: false, valid: true } as const;
  }
  if (value === "1") return { value: true, valid: true } as const;
  return { value: false, valid: false } as const;
}

export function parseQuizMode(value: string | null) {
  if (value === null || value === "" || value === "study") {
    return { value: "study", valid: true } as const;
  }
  if (value === "exam") return { value: "exam", valid: true } as const;
  return { value: "study", valid: false } as const;
}
