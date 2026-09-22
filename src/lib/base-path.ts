/**
 * Public mount for the OS reverse proxy and local dogfood.
 * Next `basePath` prefixes Link, redirect(), and `/_next` assets.
 * Browser fetches, form actions, raw anchors, and the web manifest do not.
 */
export const PUBLIC_BASE_PATH = "/line";

export function appBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH;
  const value = raw == null || raw === "" ? PUBLIC_BASE_PATH : raw;
  if (value === "/") return "";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/+$/, "");
}

/** Prefix an app-relative path. Absolute and already-prefixed URLs pass through. */
export function withBasePath(path: string, base: string = appBasePath()): string {
  if (!path) return base ? `${base}/` : "/";
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const prefix = base.replace(/\/+$/, "");
  if (!prefix) return path;

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `${pathname}${query}${hash}`;
  }
  return `${prefix}${pathname}${query}${hash}`;
}

export function pwaManifestFields(base: string = appBasePath()) {
  return {
    start_url: withBasePath("/", base),
    scope: withBasePath("/", base),
    icons: [
      withBasePath("/icons/icon-192.png", base),
      withBasePath("/icons/icon-512.png", base),
      withBasePath("/icons/icon.svg", base),
    ],
    appleTouchIcon: withBasePath("/icons/apple-touch-icon.png", base),
    manifestHref: withBasePath("/manifest.webmanifest", base),
  };
}
