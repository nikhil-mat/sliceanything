#!/bin/sh
# Browser tests. Needs a dev server on :8788 (npx wrangler dev --port 8788)
# and playwright-core + a chromium build; see README.
set -e
node mkpng.js
for t in 1-integration.js 2-slicing.js 3-combo-bomb.js 4-audio.js 5-powerups.js 6-mona.js; do
  printf '%-20s' "$t"
  node "$t" | tail -1
done
