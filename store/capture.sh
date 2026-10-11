#!/usr/bin/env bash
# Regenerates the Chrome Web Store screenshots and promo tiles in store/images.
# Renders the real extension pages with sample data from store/scenes/mock.js.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT="${PORT:-8790}"
OUT="store/images"
SERVE="$(mktemp -d)"
PROFILE="$(mktemp -d)"

npx wxt build >/dev/null

cp -R .output/chrome-mv3/. "$SERVE/"
cp -R store/scenes "$SERVE/scenes"
cp -R store/scenes/art "$SERVE/photos"
cp src/assets/icon.svg "$SERVE/scenes/icon.svg"
for page in save popup options; do
  sed -i.bak 's#<head>#<head><script src="/scenes/mock.js"></script>#' "$SERVE/$page.html"
done

python3 -m http.server "$PORT" --directory "$SERVE" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -rf "$SERVE" "$PROFILE"' EXIT
sleep 1

mkdir -p "$OUT"

shoot() {
  local name="$1" width="$2" height="$3" background="${4:-ffffffff}"
  rm -f "$OUT/$name.png"
  # Headless Chrome on macOS can keep running after writing the screenshot, so stop it once the file exists.
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --default-background-color="$background" \
    --user-data-dir="$PROFILE" \
    --host-resolver-rules="MAP *.wanderlust.example 127.0.0.1:$PORT" \
    --window-size="$width,$height" \
    --virtual-time-budget=6000 \
    --screenshot="$OUT/$name.png" \
    "http://localhost:$PORT/scenes/$name.html" >/dev/null 2>&1 &
  local chrome_pid=$!
  for _ in $(seq 1 60); do
    [[ -s "$OUT/$name.png" ]] && break
    sleep 0.5
  done
  sleep 0.5
  kill "$chrome_pid" 2>/dev/null || true
  wait "$chrome_pid" 2>/dev/null || true
  [[ -s "$OUT/$name.png" ]] || { echo "Failed to capture $name" >&2; exit 1; }
  echo "Saved $OUT/$name.png (${width}x${height})"
}

shoot 01-right-click 1280 800
shoot 02-find-files 1280 800
shoot 03-review 1280 800
shoot 04-popup 1280 800
shoot 05-setup 1280 800
shoot promo-small 440 280
shoot promo-marquee 1400 560
# Headless Chrome won't size a window down to 128px, so render at 512px and scale down.
shoot store-icon 512 512 00000000
sips -z 128 128 "$OUT/store-icon.png" >/dev/null
echo "Resized $OUT/store-icon.png to 128x128"
