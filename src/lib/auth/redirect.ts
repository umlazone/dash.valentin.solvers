export function safeRedirectPath(candidate: string, origin: string) {
  try {
    const base = new URL(origin);
    const target = new URL(candidate, base);
    if (target.origin !== base.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}` || "/";
  } catch {
    return "/";
  }
}
