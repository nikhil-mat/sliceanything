const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log((ok?'PASS':'FAIL')+' — '+n+(d?'  ['+d+']':''));};
const sliceOne=`async (kind) => {
  const E=window.SLICE; E.spawn(kind);
  for(let i=0;i<80;i++){
    const t=E.targets().find(o=> kind==='frost' ? o.frost : (kind==='bomb'? o.bomb : (!o.bomb&&!o.frost)));
    if(t && t.y<window.innerHeight-120){ E.cut({x:t.x-160,y:t.y},{x:t.x+160,y:t.y}); return true; }
    await new Promise(r=>setTimeout(r,10));
  }
  return false;
}`;
(async()=>{
  const b=await chromium.launch({executablePath:EXEC,args:['--mute-audio']});
  const page=await b.newPage({viewport:{width:1100,height:760}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/',{waitUntil:'load'});
  await page.click('#startBtn'); await sleep(150);

  // freeze power-up
  const fr = await page.evaluate(async (fn) => {
    const slice = eval('('+fn+')');
    const E=window.SLICE; E.start();
    const before=E.state();
    const hit=await slice('frost');
    await new Promise(r=>setTimeout(r,80));
    const during=E.state();
    return { hit, beforeScale:before.timeScale, during };
  }, sliceOne);
  check('frost orb spawns and can be sliced', fr.hit);
  check('slicing frost slows time', fr.hit && fr.during.timeScale < 0.5, 'timeScale '+fr.beforeScale+' -> '+(fr.during&&fr.during.timeScale));
  check('frost shows a banner', fr.during && fr.during.banner === 'TIME SLOWED', JSON.stringify(fr.during&&fr.during.banner));
  check('frost costs no score or lives', fr.during.score===0 && fr.during.lives===3, JSON.stringify({s:fr.during.score,l:fr.during.lives}));

  const thaw = await page.evaluate(async () => {
    await new Promise(r=>setTimeout(r,5200));
    return window.SLICE.state();
  });
  check('time returns to normal after the freeze', thaw.timeScale===1 && thaw.freezeT<=0, JSON.stringify({t:thaw.timeScale,f:thaw.freezeT.toFixed(2)}));

  // a dropped frost orb must not cost a life
  const frostMiss = await page.evaluate(async () => {
    const E=window.SLICE; E.start();
    const before=E.state().lives;
    E.spawn('frost');
    await new Promise(r=>setTimeout(r,1900));
    return { before, after:E.state().lives };
  });
  check('missing a frost orb is free', frostMiss.after===frostMiss.before, JSON.stringify(frostMiss));

  // combo banner at 3
  const banner = await page.evaluate(async (fn) => {
    const slice = eval('('+fn+')');
    const E=window.SLICE; E.start();
    for(let i=0;i<3;i++) await slice('target');
    return { banner:E.state().banner, combo:E.state().combo };
  }, sliceOne);
  check('3-chain raises a combo banner', banner.banner==='3 SLICE COMBO', JSON.stringify(banner));

  // splatter layer actually accumulates pixels
  const stainPixels = await page.evaluate(async (fn) => {
    const slice = eval('('+fn+')');
    const E=window.SLICE; E.start();
    const c=document.getElementById('stage');
    for(let i=0;i<4;i++) await slice('target');
    await new Promise(r=>setTimeout(r,3000)); // let halves and particles clear off screen
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0; for(let i=3;i<d.length;i+=160) if(d[i]>8) n++;
    return n;
  }, sliceOne);
  check('juice stains persist on the backdrop', stainPixels>200, stainPixels+' stained samples');

  // stains reset between rounds
  const cleared = await page.evaluate(async () => {
    window.SLICE.start();
    await new Promise(r=>setTimeout(r,120));
    const c=document.getElementById('stage');
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0; for(let i=3;i<d.length;i+=160) if(d[i]>8) n++;
    return n;
  });
  check('a new round starts on a clean screen', cleared<60, cleared+' samples');

  // criticals fire over many slices and pay double
  const crit = await page.evaluate(async (fn) => {
    const slice = eval('('+fn+')');
    const E=window.SLICE; let crits=0;
    for(let n=0;n<40;n++){
      E.start();
      const before=E.state().score;
      await slice('target');
      if(E.state().score-before===2) crits++;
    }
    return crits;
  }, sliceOne);
  check('critical slices occur and pay double', crit>0 && crit<25, crit+'/40 first-slice crits (expect ~5)');
  check('no JS errors', errors.length===0, errors.slice(0,2).join('|'));
  await b.close();
  const bad=res.filter(r=>!r).length;
  console.log('\n'+(res.length-bad)+'/'+res.length+' checks passed');
  process.exit(bad?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
