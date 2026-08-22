// Resolve a Chromium binary: $CHROME_PATH, a cached Playwright build, or system Chrome.
const fs = require('fs'), path = require('path');
function find(){
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  if (fs.existsSync(cache)) {
    for (const dir of fs.readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().reverse()) {
      for (const name of ['Google Chrome for Testing', 'Chromium']) {
        const p = path.join(cache, dir, 'chrome-mac-arm64', name + '.app/Contents/MacOS/' + name);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(sys)) return sys;
  throw new Error('No Chromium found. Set CHROME_PATH or run: npx playwright install chromium');
}
module.exports = find();
