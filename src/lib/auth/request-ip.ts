export function trustedClientIp(headers: Headers) {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for") ||
    "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
}
