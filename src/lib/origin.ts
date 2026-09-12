function sanitizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  return host.replace(/^0\.0\.0\.0(?=[:/]|$)/, "127.0.0.1");
}

/** Browser Host (or X-Forwarded-Host), never the bind address 0.0.0.0. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host =
    sanitizeHost(request.headers.get("x-forwarded-host")) ??
    sanitizeHost(request.headers.get("host")) ??
    sanitizeHost(url.host) ??
    "127.0.0.1";
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "") ?? "http";
  return `${proto}://${host}`;
}
