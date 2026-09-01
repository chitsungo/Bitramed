export const ADMIN_BASE = "/JAK2V617F" as const;

export function adminPath(path = "") {
  const suffix = path ? `/${path.replace(/^\/+|\/+$/g, "")}` : "";
  return `${ADMIN_BASE}${suffix}/`;
}

export function safeInternalPath(value: string | null | undefined) {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "";
  }
  try {
    const url = new URL(path, "https://bitramed.invalid");
    return url.origin === "https://bitramed.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : "";
  } catch {
    return "";
  }
}
