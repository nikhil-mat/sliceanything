
## Tests

Browser tests drive the real game in Chromium — slicing, combos, bombs,
frost orbs, splatter, and the WebAudio graph (asserted at the node level).

```
npx wrangler dev --port 8788      # in one shell
cd test && npm i playwright-core && ./run.sh
```
