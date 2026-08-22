const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log((ok?'PASS':'FAIL')+' — '+n+(d?'  ['+d+']':''));};
(async()=>{
  const b=await chromium.launch({executablePath:EXEC,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const page=await b.newPage({viewport:{width:1180,height:820}});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8788/',{waitUntil:'load'});

  const layout = await page.evaluate(()=>{
    const s=document.getElementById('startBtn').getBoundingClientRect();
    const m=document.getElementById('monaBtn').getBoundingClientRect();
    return { sameRow:Math.abs(s.top-m.top)<2, after:m.left>s.right, gap:Math.round(m.left-s.right) };
  });
  check('mode button sits beside Start', layout.sameRow && layout.after, JSON.stringify(layout));

  await page.click('#monaBtn'); await sleep(500);
  const on = await page.evaluate(()=>({
    mona:window.SLICE.mona(), running:window.SLICE.state().running,
    pool:window.SLICE.pool().length, sprite:window.SLICE.pool()[0].w+'x'+window.SLICE.pool()[0].h,
    banner:window.SLICE.state().banner
  }));
  check('clicking it starts a round in mona mode', on.mona===true && on.running===true, JSON.stringify(on));
  check('the pool is only the painting', on.pool===1 && /^\d+x\d+$/.test(on.sprite), on.sprite);
  check('the mode announces itself', on.banner==='MONA LISA MODE', String(on.banner));

  // every non-bomb target in the air must be that one sprite
  const spawned = await page.evaluate(async()=>{
    for(let i=0;i<6;i++) window.SLICE.spawn('target');
    await new Promise(r=>setTimeout(r,150));
    const t=window.SLICE.targets().filter(o=>!o.bomb&&!o.frost);
    return { n:t.length, pool:window.SLICE.pool().length };
  });
  check('targets spawn from it', spawned.n>=6 && spawned.pool===1, JSON.stringify(spawned));

  // uploads are untouched underneath, and Start returns to normal
  const back = await page.evaluate(()=>{
    document.getElementById('overlay').hidden=false;
    document.getElementById('startBtn').click();
    return { mona:window.SLICE.mona(), pool:window.SLICE.pool().length };
  });
  check('Start slicing leaves the mode', back.mona===false && back.pool===8, JSON.stringify(back));

  // and it can be re-entered without reloading the painting
  await page.evaluate(()=>{ document.getElementById('overlay').hidden=false; });
  await page.click('#monaBtn'); await sleep(150);
  check('mode can be re-entered', await page.evaluate(()=>window.SLICE.mona() && window.SLICE.pool().length===1));

  check('no JS errors', errs.length===0, errs.join(' | '));
  await b.close();
  const bad=res.filter(r=>!r).length;
  console.log('\n'+(res.length-bad)+'/'+res.length+' checks passed');
  process.exit(bad?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
