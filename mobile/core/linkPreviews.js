/**
 * Lightweight, no-backend link preview helpers.
 *
 * Goal: high-value providers (YouTube) without scraping OpenGraph or adding new data structures.
 * We store remote thumbnail URLs directly in `quest.imageUri` (React Native Image supports https:// URIs).
 */

/**
 * Extract a YouTube video id from common URL formats.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 *
 * @param {string} url
 * @returns {string|null}
 */
export function getYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;

  let u;
  try {
    u = new URL(url);
  } catch {
    // If it's missing protocol, try https:// (models validateQuestAction adds this, but be defensive).
    try {
      u = new URL("https://" + url);
    } catch {
      return null;
    }
  }

  const host = (u.hostname || "").toLowerCase();
  const path = u.pathname || "";

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = path.replace(/^\/+/, "").split("/")[0] || "";
    return sanitizeYouTubeId(id);
  }

  // *.youtube.com/*
  if (host.endsWith("youtube.com")) {
    // /watch?v=<id>
    if (path === "/watch") {
      const id = u.searchParams.get("v") || "";
      return sanitizeYouTubeId(id);
    }

    // /shorts/<id>
    if (path.startsWith("/shorts/")) {
      const id = path.split("/")[2] || "";
      return sanitizeYouTubeId(id);
    }

    // /embed/<id>
    if (path.startsWith("/embed/")) {
      const id = path.split("/")[2] || "";
      return sanitizeYouTubeId(id);
    }
  }

  return null;
}

function sanitizeYouTubeId(id) {
  // YouTube ids are 11 chars, but be tolerant; just reject obviously bogus stuff.
  if (!id || typeof id !== "string") return null;
  const clean = id.trim();
  if (!clean) return null;
  // Stop at any query-ish leftovers.
  const first = clean.split("?")[0].split("&")[0].split("#")[0];
  // Basic charset check.
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(first)) return null;
  return first;
}

/**
 * Canonical thumbnail URL (safe default).
 * `maxresdefault.jpg` is nicer when it exists, but it sometimes 404s; `hqdefault.jpg` is reliable.
 */
export function getYouTubeThumbnailUrl(videoId) {
  const id = sanitizeYouTubeId(videoId);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * If the action URL is supported, returns a preview image URL, else null.
 * @param {{type:string,value:string}|null} action
 * @returns {string|null}
 */
export function getAutoImageUriForAction(action) {
  if (!action || action.type !== "url" || !action.value) return null;
  const id = getYouTubeVideoId(action.value);
  if (id) return getYouTubeThumbnailUrl(id);
  return null;
}

/**
 * Build deep-link candidates that open the YouTube app (if installed).
 * We try multiple schemes because support can vary by platform/version.
 *
 * @param {string} url
 * @returns {string[]} candidate app URLs to try with Linking.canOpenURL
 */
export function getYouTubeAppUrlCandidates(url) {
  const id = getYouTubeVideoId(url);
  if (!id) return [];

  // Android commonly supports vnd.youtube://
  // iOS commonly supports youtube://
  return [
    `vnd.youtube://watch?v=${id}`,
    `youtube://watch?v=${id}`,
    `youtube://${id}`,
  ];
}

/**
 * Heuristic: is this an auto-generated preview image URI?
 * We keep this narrow so we don't accidentally treat user images as "auto".
 * @param {string|null} imageUri
 * @returns {boolean}
 */
export function isAutoPreviewImageUri(imageUri) {
  if (!imageUri || typeof imageUri !== "string") return false;
  return /^https:\/\/i\.ytimg\.com\/vi\/[a-zA-Z0-9_-]{6,}\/(hqdefault|maxresdefault)\.jpg$/.test(
    imageUri.trim()
  );
}


