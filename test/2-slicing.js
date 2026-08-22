const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log((ok?'PASS':'FAIL')+' — '+n+(d?'  ['+d+']':''));};

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args:['--autoplay-policy=no-user-gesture-required','--mute-audio'] });
  const page = await browser.newPage({ viewport:{width:1100,height:760} });
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/', {waitUntil:'load'});
  await page.setInputFiles('#file','target.png');
  await page.waitForFunction(()=>document.querySelectorAll('.chip').length===1);
  await page.click('#startBtn'); await sleep(200);

  // 1. deterministic slice of a known target -> exactly 2 halves + score + juice
  const slice = await page.evaluate(async () => {
    const E = window.EXNINJA;
    const before = E.state();
    E.spawn('target');
    for (let i=0;i<60;i++){ // wait until it is on screen
      const t = E.targets().find(t => t.y < window.innerHeight - 120);
      if (t) {
        E.cut({x:t.x-200,y:t.y},{x:t.x+200,y:t.y});
        await new Promise(r=>setTimeout(r,50));
        const after = E.state();
        return { hit:true, before, after };
      }
      await new Promise(r=>setTimeout(r,25));
    }
    return { hit:false };
  });
  check('target reachable and sliced', slice.hit);
  check('slice creates two halves', slice.hit && slice.after.halves - slice.before.halves === 2,
        slice.hit ? slice.before.halves+' -> '+slice.after.halves : '');
  check('slice awards score', slice.hit && slice.after.score > slice.before.score,
        slice.hit ? slice.before.score+' -> '+slice.after.score : '');
  check('slice throws juice particles', slice.hit && slice.after.bits > 20, slice.hit ? slice.after.bits+' particles':'');

  // 2. halves fly apart and expire
  const halvesGone = await page.evaluate(async () => {
    await new Promise(r=>setTimeout(r,3200));
    return window.EXNINJA.state().halves;
  });
  check('halves are cleaned up after falling', halvesGone === 0, 'halves='+halvesGone);

  // (combo + bomb behaviour covered in isolation by test3.js)

  // 5. a dropped target costs a life
  const missRes = await page.evaluate(async () => {
    const E = window.EXNINJA; E.start();
    const before = E.state().lives;
    E.spawn('target');
    await new Promise(r=>setTimeout(r,1800));
    return { before, after:E.state().lives };
  });
  check('missed target costs a life', missRes.after < missRes.before, JSON.stringify(missRes));

  // 6. three misses end the round
  const end = await page.evaluate(async () => {
    const E = window.EXNINJA; E.start();
    for (let i=0;i<12 && E.state().running;i++){ E.spawn('target'); await new Promise(r=>setTimeout(r,400)); }
    return E.state();
  });
  check('round ends at zero lives', end.running===false && end.lives<=0, JSON.stringify(end));
  await sleep(900);
  check('game-over card shown', await page.isVisible('#overlay'));
  check('no JS errors', errors.length===0, errors.slice(0,2).join('|'));
  await page.screenshot({path:'shot-5-verify.png'});
  await browser.close();
  const bad = res.filter(r=>!r).length;
  console.log('\n'+(res.length-bad)+'/'+res.length+' checks passed');
  process.exit(bad?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
