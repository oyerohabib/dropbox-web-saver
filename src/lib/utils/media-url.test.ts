import { describe, expect, it } from "vitest";
import {
  decodeEmbeddedMediaUrl,
  isStreamedMediaUrl,
  mediaIdentityKey,
  pickDownloadableMediaUrl,
  structuredMediaUrlsFromJsonLd,
} from "./media-url";

const PIN_HASH = "39a4e6a7008f1736d870d378271be319";
const CLOSEUP_HASH = "02a4d289ee08848c19cdad427d7e5d41";
const MP4_720 = `https://v1.pinimg.com/videos/iht/expMp4/39/a4/e6/${PIN_HASH}_720w.mp4`;
const MP4_540 = `https://v1.pinimg.com/videos/iht/hevcMp4V3/39/a4/e6/${PIN_HASH}_540w.mp4`;
const HLS = `https://v1.pinimg.com/videos/iht/hls/39/a4/e6/${PIN_HASH}.m3u8`;
const CLOSEUP_MP4 = `https://v1.pinimg.com/videos/iht/720p/02/a4/d2/${CLOSEUP_HASH}.mp4`;
const CLOSEUP_POSTER = `https://i.pinimg.com/videos/thumbnails/originals/02/a4/d2/${CLOSEUP_HASH}.0000000.jpg`;
const CLOSEUP_AV1 = `https://v1.pinimg.com/videos/iht/av1Mp4-enabled-v4-t/02/a4/d2/${CLOSEUP_HASH}_720w.mp4`;
const CLOSEUP_HEVC = `https://v1.pinimg.com/videos/iht/hevcMp4V3/02/a4/d2/${CLOSEUP_HASH}_720w.mp4`;

describe("isStreamedMediaUrl", () => {
  it("treats blobs and playlists as streams", () => {
    expect(isStreamedMediaUrl("blob:https://www.pinterest.com/abc")).toBe(true);
    expect(isStreamedMediaUrl(HLS)).toBe(true);
    expect(isStreamedMediaUrl(MP4_720)).toBe(false);
  });
});

describe("pickDownloadableMediaUrl", () => {
  it("keeps a direct mp4 click target", () => {
    expect(pickDownloadableMediaUrl(MP4_720, [HLS, MP4_540])).toBe(MP4_720);
  });

  it("replaces a blob or HLS click with the best matching mp4", () => {
    expect(
      pickDownloadableMediaUrl("blob:https://www.pinterest.com/abc", [HLS, MP4_540, MP4_720]),
    ).toBe(MP4_720);
    expect(pickDownloadableMediaUrl(HLS, [MP4_540, MP4_720, HLS])).toBe(MP4_720);
  });

  it("prefers the mp4 that shares the stream's identity", () => {
    const other = "https://v1.pinimg.com/videos/iht/expMp4/aa/bb/cc/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_1080w.mp4";
    expect(pickDownloadableMediaUrl(HLS, [other, MP4_540])).toBe(MP4_540);
  });

  it("keeps the closeup video when a related pin has a higher-scoring expMp4", () => {
    expect(
      pickDownloadableMediaUrl(
        "blob:https://www.pinterest.com/abc",
        [MP4_720, HLS, CLOSEUP_MP4],
        [CLOSEUP_POSTER, CLOSEUP_MP4],
      ),
    ).toBe(CLOSEUP_MP4);
  });

  it("never resolves a video to its thumbnail image", () => {
    expect(
      pickDownloadableMediaUrl("blob:https://www.pinterest.com/abc", [MP4_720], [CLOSEUP_POSTER]),
    ).toBe("blob:https://www.pinterest.com/abc");
  });

  it("does not guess between several unrelated videos", () => {
    expect(
      pickDownloadableMediaUrl("blob:https://www.pinterest.com/abc", [MP4_720, CLOSEUP_MP4]),
    ).toBe("blob:https://www.pinterest.com/abc");
  });

  it("prefers the canonical 720p file over experimental codecs of the same video", () => {
    expect(
      pickDownloadableMediaUrl(
        "blob:https://www.pinterest.com/abc",
        [CLOSEUP_AV1, CLOSEUP_HEVC, CLOSEUP_MP4],
        [CLOSEUP_MP4],
      ),
    ).toBe(CLOSEUP_MP4);
  });
});

describe("structuredMediaUrlsFromJsonLd", () => {
  it("reads the closeup VideoObject content URL", () => {
    const jsonLd = JSON.stringify({
      "@type": "VideoObject",
      "@id": `https://www.pinterest.com/pin/how-to-remove-creases--587508713926725549/`,
      contentUrl: CLOSEUP_MP4,
      thumbnailUrl: CLOSEUP_POSTER,
    });

    expect(
      structuredMediaUrlsFromJsonLd(
        [jsonLd],
        "https://www.pinterest.com/pin/587508713926725549/",
      ),
    ).toEqual([CLOSEUP_MP4, CLOSEUP_POSTER]);
  });

  it("ignores metadata left over from a previously viewed pin", () => {
    const stale = JSON.stringify({
      "@type": "VideoObject",
      "@id": "https://www.pinterest.com/pin/some-other-pin--111111111111111111/",
      contentUrl: MP4_720,
    });

    expect(
      structuredMediaUrlsFromJsonLd([stale], "https://www.pinterest.com/pin/587508713926725549/"),
    ).toEqual([]);
  });
});

describe("decodeEmbeddedMediaUrl", () => {
  it("unescapes JSON-embedded Pinterest URLs", () => {
    expect(decodeEmbeddedMediaUrl(`https:\\u002F\\u002Fv1.pinimg.com\\u002Fvideos\\u002F${PIN_HASH}.mp4`)).toBe(
      `https://v1.pinimg.com/videos/${PIN_HASH}.mp4`,
    );
  });
});

describe("mediaIdentityKey", () => {
  it("reads the Pinterest video hash", () => {
    expect(mediaIdentityKey(MP4_720)).toBe(PIN_HASH);
    expect(mediaIdentityKey(HLS)).toBe(PIN_HASH);
  });
});
