const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=[]; const check=(n,ok,d='')=>{res.push(ok);console.log((ok?'PASS':'FAIL')+' — '+n+(d?'  ['+d+']':''));};
(async()=>{
  const b=await chromium.launch({executablePath:EXEC,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const page=await b.newPage({viewport:{width:1100,height:760}});
  await page.addInitScript(() => {
    window.__snd = { osc:0, noise:0, ctx:0, running:'' };
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(...a){ super(...a); window.__snd.ctx++; }
    };
    const os = OscillatorNode.prototype.start, bs = AudioBufferSourceNode.prototype.start;
    OscillatorNode.prototype.start = function(...a){ window.__snd.osc++; return os.apply(this,a); };
    AudioBufferSourceNode.prototype.start = function(...a){ window.__snd.noise++; return bs.apply(this,a); };
  });
  await page.goto('http://127.0.0.1:8788/',{waitUntil:'load'});
  await page.click('#startBtn'); await sleep(200);
  const s0 = await page.evaluate(()=>({...window.__snd}));
  check('AudioContext created on first interaction', s0.ctx===1, JSON.stringify(s0));

  const sliceSound = await page.evaluate(async () => {
    const E=window.EXNINJA; E.start();
    const before={...window.__snd};
    E.spawn('target');
    for(let i=0;i<80;i++){
      const t=E.targets().find(o=>!o.bomb&&o.y<window.innerHeight-120);
      if(t){ E.cut({x:t.x-150,y:t.y},{x:t.x+150,y:t.y}); break; }
      await new Promise(r=>setTimeout(r,10));
    }
    await new Promise(r=>setTimeout(r,100));
    const after={...window.__snd};
    return { oscDelta:after.osc-before.osc, noiseDelta:after.noise-before.noise };
  });
  check('slicing fires oscillator + noise voices', sliceSound.oscDelta>=2 && sliceSound.noiseDelta>=1, JSON.stringify(sliceSound));

  const bladeSound = await page.evaluate(()=>({...window.__snd}));
  await page.mouse.move(100,400); await page.mouse.down();
  for(let x=100;x<1000;x+=40) await page.mouse.move(x,400+Math.sin(x/90)*40);
  await page.mouse.up(); await sleep(150);
  const after2 = await page.evaluate(()=>({...window.__snd}));
  check('fast blade swipe plays a whoosh', after2.noise>bladeSound.noise, bladeSound.noise+' -> '+after2.noise);

  const muted = await page.evaluate(async () => {
    document.getElementById('muteBtn').click();
    const before={...window.__snd};
    const E=window.EXNINJA;
    E.spawn('target');
    for(let i=0;i<80;i++){
      const t=E.targets().find(o=>!o.bomb&&o.y<window.innerHeight-120);
      if(t){ E.cut({x:t.x-150,y:t.y},{x:t.x+150,y:t.y}); break; }
      await new Promise(r=>setTimeout(r,10));
    }
    await new Promise(r=>setTimeout(r,80));
    const after={...window.__snd};
    return { label:document.getElementById('muteBtn').textContent,
             delta:(after.osc-before.osc)+(after.noise-before.noise) };
  });
  check('mute button silences everything', muted.delta===0 && /off/.test(muted.label), JSON.stringify(muted));

  const overSound = await page.evaluate(async () => {
    document.getElementById('muteBtn').click();
    const E=window.EXNINJA; E.start();
    const before={...window.__snd};
    for(let i=0;i<12 && E.state().running;i++){ E.spawn('target'); await new Promise(r=>setTimeout(r,380)); }
    return { oscDelta:window.__snd.osc-before.osc, running:E.state().running };
  });
  check('miss + game-over stingers play', overSound.oscDelta>=4 && !overSound.running, JSON.stringify(overSound));
  await b.close();
  const bad=res.filter(r=>!r).length;
  console.log('\n'+(res.length-bad)+'/'+res.length+' checks passed');
  process.exit(bad?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)});
