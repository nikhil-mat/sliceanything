const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log((ok?'PASS':'FAIL')+' — '+n+(d?'  ['+d+']':''));};
(async()=>{
  const b=await chromium.launch({executablePath:EXEC,args:['--mute-audio']});
  const page=await b.newPage({viewport:{width:1100,height:760}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/',{waitUntil:'load'});
  await page.click('#startBtn'); await sleep(150);

  // combo measured at the instant of the slice
  const chain = await page.evaluate(async () => {
    const E=window.SLICE; E.start(); const marks=[]; const start=E.state().score;
    for(let n=0;n<3;n++){
      E.spawn('target');
      for(let i=0;i<80;i++){
        const t=E.targets().find(t=>!t.bomb && t.y<window.innerHeight-120);
        if(t){ E.cut({x:t.x-200,y:t.y},{x:t.x+200,y:t.y}); marks.push(E.state().combo); break; }
        await new Promise(r=>setTimeout(r,10));
      }
    }
    return { marks, gained:E.state().score-start };
  });
  check('combo counter climbs with each chained slice', JSON.stringify(chain.marks)==='[1,2,3]', JSON.stringify(chain));
  // base chain is 1+2+3=6; any of those slices may crit for double, so 6..12
  check('chain pays escalating bonuses (6 base, up to 12 with crits)',
        chain.gained>=6 && chain.gained<=12, 'gained '+chain.gained);

  const decay = await page.evaluate(async () => {
    await new Promise(r=>setTimeout(r,1000));
    return window.SLICE.state().combo;
  });
  check('combo decays after its window', decay===0, 'combo='+decay);

  // isolated bomb: fresh round (elapsed<6 blocks random bombs), single forced bomb
  const bomb = await page.evaluate(async () => {
    const E=window.SLICE; E.start();
    const before=E.state().lives;
    E.spawn('bomb');
    for(let i=0;i<80;i++){
      const t=E.targets();
      const bm=t.find(o=>o.bomb && o.y<window.innerHeight-120);
      if(bm){ const others=t.filter(o=>o.bomb).length;
        E.cut({x:bm.x-120,y:bm.y},{x:bm.x+120,y:bm.y});
        await new Promise(r=>setTimeout(r,60));
        return { hit:true, bombsOnScreen:others, before, after:E.state().lives, running:E.state().running };
      }
      await new Promise(r=>setTimeout(r,10));
    }
    return {hit:false};
  });
  check('one bomb costs exactly one life', bomb.hit && bomb.after===bomb.before-1, JSON.stringify(bomb));
  check('no JS errors', errors.length===0, errors.join('|'));
  await b.close();
  const bad=res.filter(r=>!r).length;
  console.log('\n'+(res.length-bad)+'/'+res.length+' checks passed');
  process.exit(bad?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
