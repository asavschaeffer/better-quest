import test from "node:test";
import assert from "node:assert/strict";

import {
  getYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getAutoImageUriForAction,
  isAutoPreviewImageUri,
} from "../core/linkPreviews.js";

test("getYouTubeVideoId extracts id from watch URLs", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(getYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=12"), "dQw4w9WgXcQ");
});

test("getYouTubeVideoId extracts id from youtu.be", () => {
  assert.equal(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ");
});

test("getYouTubeVideoId extracts id from shorts/embed", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(getYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("getYouTubeThumbnailUrl builds hqdefault thumbnail", () => {
  assert.equal(
    getYouTubeThumbnailUrl("dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
});

test("getAutoImageUriForAction returns thumbnail for url actions", () => {
  assert.equal(
    getAutoImageUriForAction({ type: "url", value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
  assert.equal(getAutoImageUriForAction({ type: "app", value: "youtube://something" }), null);
});

test("isAutoPreviewImageUri only matches our youtube thumb URLs", () => {
  assert.equal(
    isAutoPreviewImageUri("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"),
    true
  );
  assert.equal(
    isAutoPreviewImageUri("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"),
    true
  );
  assert.equal(
    isAutoPreviewImageUri("https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg"),
    false
  );
  assert.equal(isAutoPreviewImageUri("file:///abc/quest-images/quest-1.jpg"), false);
});


