// String.fromCharCode spreads its arguments onto the stack, so large buffers must be encoded in slices.
const ENCODE_CHUNK_SIZE = 0x8000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += ENCODE_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + ENCODE_CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
