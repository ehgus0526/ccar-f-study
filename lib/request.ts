// Next.js can construct request.url with its internal bind host (e.g. 0.0.0.0).
// Compare the browser Origin with the actual request Host, as Server Actions do.
export function hasSameOrigin(headers: Headers) {
  const origin = headers.get("origin");
  const host =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === host;
  } catch {
    return false;
  }
}
