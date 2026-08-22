# Ex Ninja

Fruit-ninja style slicing game where you supply the targets. Drop in photos —
they get launched into the air for you to cut in half.

`public/index.html` is the entire game: one file, no dependencies, no image or
audio assets. Served as a Cloudflare Workers static-assets app.

## Playing

- **Targets** come from the file picker, drag-and-drop anywhere, or paste from
  the clipboard. With nothing uploaded it falls back to emoji fruit.
- **Slice** by dragging the blade across a target. Chained slices inside the
  combo window escalate: 1, then 2, then 3 points, with a banner at 3, 5, 8, 12.
- **Criticals** fire on roughly one slice in eight and pay double.
- **Bombs** cost a life. So does letting a target fall past you. Three and the
  round is over.
- **Frost orbs** slow time to a third for 4.5 seconds. Missing one is free.
- Sound is a WebAudio synth kit — blade whoosh, slice, splat, freeze chime,
  explosion, game-over chord. Toggle with the Sound button. `Space` restarts,
  `Esc` pauses out to the menu.

## Run locally

```
npx wrangler dev
```

## Deploy

```
npx wrangler deploy
```

Publishes to your Cloudflare account at `exninja.<your-subdomain>.workers.dev`.

## Tests

Five Playwright suites (52 checks) drive the real game in Chromium: uploads and
roster handling, slicing geometry and half-generation, combo and bomb rules, the
frost/critical/splatter mechanics, and the audio graph — verified by counting
oscillator and buffer-source starts, so a silent regression fails the build.

```
npx wrangler dev --port 8788          # one shell
cd test && npm i playwright-core && ./run.sh
```

`test/chrome.js` finds a browser via `CHROME_PATH`, a cached Playwright build,
or system Chrome.
