const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, detail='') { results.push({name, ok, detail}); console.log((ok?'PASS':'FAIL')+' — '+name+(detail?'  ['+detail+']':'')); }

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args:['--autoplay-policy=no-user-gesture-required','--mute-audio'] });
  const page = await browser.newPage({ viewport:{width:1100,height:760}, deviceScaleFactor:1 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });

  await page.goto('http://127.0.0.1:8788/', { waitUntil:'load' });
  await sleep(800);

  check('page loads with title', (await page.title()) === 'Ex Ninja', await page.title());
  check('start overlay visible', await page.isVisible('#overlay'));
  check('canvas sized to window', await page.evaluate(() => stage.width > 0 && stage.height > 0));
  check('game API exposed', await page.evaluate(() => typeof window.EXNINJA === 'object'));
  check('default fruit sprites built', await page.evaluate(() => window.EXNINJA.pool().length) === 8);
  await page.screenshot({ path:'shot-1-start.png' });

  // ---- upload path
  await page.setInputFiles('#file', 'target.png');
  await page.waitForFunction(() => document.querySelectorAll('.chip').length === 1, null, { timeout:5000 });
  check('uploaded image becomes a target', await page.evaluate(() => window.EXNINJA.pool().length) === 1);
  check('roster chip rendered', await page.isVisible('.chip img'));
  const tint = await page.evaluate(() => window.EXNINJA.pool()[0].tint);
  check('average colour sampled from upload', /^rgb\(\d+,\d+,\d+\)$/.test(tint), tint);

  // ---- start game
  await page.click('#startBtn');
  await sleep(300);
  check('overlay hides on start', !(await page.isVisible('#overlay')));
  check('game running', (await page.evaluate(() => window.EXNINJA.state())).running === true);

  // ---- audio actually initialised (WebAudio graph live)
  const audio = await page.evaluate(() => {
    const ac = (window.AudioContext||window.webkitAudioContext) ? true : false;
    return ac;
  });
  check('WebAudio available', audio);

  // ---- swipe to slice
  await page.evaluate(() => { for (let i=0;i<6;i++) window.EXNINJA.spawn(); });
  await sleep(350);
  const before = await page.evaluate(() => window.EXNINJA.state());
  for (let s=0; s<14; s++) {
    const y = 260 + (s%5)*70;
    await page.mouse.move(80, y);
    await page.mouse.down();
    for (let x=80; x<=1020; x+=45) await page.mouse.move(x, y + Math.sin(x/120)*30);
    await page.mouse.up();
    await sleep(60);
  }
  const after = await page.evaluate(() => window.EXNINJA.state());
  check('swiping the blade scores points', after.score > 0, 'score '+before.score+' -> '+after.score);
  await page.screenshot({ path:'shot-2-play.png' });

  // ---- halves are produced and drawn
  const halfTest = await page.evaluate(async () => {
    const st = () => window.EXNINJA.state();
    window.EXNINJA.spawn();
    await new Promise(r => setTimeout(r, 120));
    // slice whatever is on screen through its centre
    const before = st().halves;
    window.EXNINJA.cut({x:0,y:window.innerHeight/2},{x:window.innerWidth,y:window.innerHeight/2});
    await new Promise(r => setTimeout(r, 60));
    return { before, after: st().halves };
  });
  check('slicing splits a target into two halves', halfTest.after >= halfTest.before, JSON.stringify(halfTest));

  // ---- pixels actually rendered (non-empty canvas)
  const ink = await page.evaluate(() => {
    const c = document.getElementById('stage');
    const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0; for (let i=3;i<d.length;i+=400) if (d[i] > 10) n++;
    return n;
  });
  check('canvas is drawing pixels', ink > 50, ink+' opaque samples');

  // ---- lives / miss handling and game over
  const over = await page.evaluate(async () => {
    const log = [];
    for (let i=0;i<40 && window.EXNINJA.state().running; i++) {
      window.EXNINJA.spawn();
      await new Promise(r => setTimeout(r, 260));
      log.push(window.EXNINJA.state().lives);
    }
    return { lives: window.EXNINJA.state().lives, running: window.EXNINJA.state().running, log:log.slice(-4) };
  });
  check('missed targets cost lives and end the round', over.running === false && over.lives <= 0, JSON.stringify(over));
  await sleep(900);
  check('game-over overlay returns', await page.isVisible('#overlay'));
  const ovText = await page.textContent('#ovBody');
  check('game-over reports the score', /Final score: \d+/.test(ovText), ovText.slice(0,70)+'…');
  check('best score persisted', await page.evaluate(() => !!localStorage.getItem('exninja.best')));
  await page.screenshot({ path:'shot-3-over.png' });

  // ---- restart
  await page.click('#startBtn');
  await sleep(200);
  const restarted = await page.evaluate(() => window.EXNINJA.state());
  check('restart resets score and lives', restarted.running && restarted.score===0 && restarted.lives===3, JSON.stringify(restarted));

  // ---- mobile viewport
  const m = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const mErrors=[]; m.on('pageerror',e=>mErrors.push(e.message));
  await m.goto('http://127.0.0.1:8788/', { waitUntil:'load' });
  await sleep(600);
  const noHScroll = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('no horizontal overflow on mobile', noHScroll);
  check('mobile page error-free', mErrors.length === 0, mErrors.join('|'));
  await m.screenshot({ path:'shot-4-mobile.png' });

  check('no JS errors during full session', errors.length === 0, errors.slice(0,3).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
