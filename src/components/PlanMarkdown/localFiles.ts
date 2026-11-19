// Helpers for rendering local file references (file:// URLs and Windows paths)
// inside markdown. Mirrors the host framework Markdown widget: a browser cannot
// load file:// resources from a served page, so local file images are routed
// through the host's /host/local-file proxy endpoint. Both the host origin and
// the "local files enabled" flag are published by the host as meta tags.

const getMeta = (name: string): string | null =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;

const getHostBasePath = (): string => getMeta("sc-path-base") ?? "";

export function getHostOrigin(): string {
  const metaHost = getMeta("sc-host");
  if (metaHost) {
    try {
      const url = metaHost.includes("://") ? new URL(metaHost) : new URL(`https://${metaHost}`);
      if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "tauri:") {
        const origin =
          url.origin && url.origin !== "null" ? url.origin : `${url.protocol}//${url.host}`;
        return origin + getHostBasePath();
      }
    } catch {
      // Ignore parse errors and fall back to the current origin.
    }
  }
  const locOrigin =
    typeof window !== "undefined" && window.location
      ? window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : `${window.location.protocol}//${window.location.host}`
      : "";
  return locOrigin + getHostBasePath();
}

/** True when the host serves the /host/local-file proxy (opt-in, dev-only). */
export function isLocalFilesEnabled(): boolean {
  return getMeta("sc-dangerously-allow-local-files") === "true";
}

const isWindowsPath = (url: string): boolean => /^[a-zA-Z]:[\\/]/.test(url);

/** True for file:// URLs and bare Windows drive paths (e.g. D:\foo). */
export function isLocalFileUrl(url: string): boolean {
  return url.startsWith("file://") || isWindowsPath(url);
}

const toFileUrl = (url: string): string =>
  isWindowsPath(url) ? `file:///${url.replace(/\\/g, "/")}` : url;

/**
 * Transforms a local file reference for use in markup.
 * - For links (key === "href"): preserve the file:// URL so OnLinkClick / the
 *   anchor renderer can handle it.
 * - For images (src): route through the /host/local-file proxy when the host
 *   supports it; otherwise pass the file:// URL through (the browser will
 *   likely block it, matching the framework's fallback).
 */
export function transformLocalFileUrl(url: string, key: string): string {
  if (key === "href") {
    return toFileUrl(url);
  }

  if (isLocalFilesEnabled()) {
    let filePath: string;
    if (url.startsWith("file://")) {
      const pathname = decodeURIComponent(new URL(url).pathname);
      filePath = /^\/[a-zA-Z]:/.test(pathname) ? pathname.slice(1) : pathname;
    } else {
      filePath = url.replace(/\\/g, "/");
    }
    return `${getHostOrigin()}/host/local-file?path=${encodeURIComponent(filePath)}`;
  }

  return toFileUrl(url);
}
