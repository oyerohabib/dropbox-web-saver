import { describe, expect, it } from "vitest";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./binary";

describe("binary utilities", () => {
  it("round-trips bytes through base64", () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    const decoded = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(original.buffer)));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("encodes buffers larger than a single encode chunk", () => {
    const original = new Uint8Array(100_000).map((_, index) => index % 256);
    const decoded = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(original.buffer)));
    expect(decoded.byteLength).toBe(original.byteLength);
    expect(decoded[99_999]).toBe(original[99_999]);
  });
});
