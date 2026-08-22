// Render slice variants offline and report where their energy actually sits.
const { chromium } = require('playwright-core');
const EXEC = require('./chrome');
(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--mute-audio'] });
  const page = await b.newPage();
  await page.goto('http://127.0.0.1:8788/', { waitUntil: 'load' });

  const out = await page.evaluate(async () => {
    const A = window.SLICE.audio;

    // Offline-render whatever `fn` schedules, then measure it.
    async function render(fn) {
      const oc = new OfflineAudioContext(1, 44100 * 1.2, 44100);
      const saved = A.ac; A.ac = oc; A.muted = false;
      fn(A);
      const buf = await oc.startRendering();
      A.ac = saved;
      const d = buf.getChannelData(0);

      // naive DFT over a log-spaced bin set: enough to locate the energy
      const bins = [];
      for (let f = 100; f < 12000; f *= 1.06) bins.push(f);
      const N = Math.min(d.length, 44100 * 0.5);
      const mags = bins.map(f => {
        let re = 0, im = 0;
        const w = 2 * Math.PI * f / 44100;
        for (let i = 0; i < N; i += 2) { re += d[i] * Math.cos(w * i); im += d[i] * Math.sin(w * i); }
        return Math.sqrt(re * re + im * im) / N;
      });
      let sum = 0, wsum = 0, peakM = 0, peakF = 0, hi = 0;
      mags.forEach((m, i) => {
        sum += m; wsum += m * bins[i];
        if (m > peakM) { peakM = m; peakF = bins[i]; }
        if (bins[i] > 3000) hi += m;
      });
      let rms = 0; for (let i = 0; i < d.length; i++) rms += d[i] * d[i];
      return {
        centroid: Math.round(wsum / sum),
        peakHz: Math.round(peakF),
        pctAbove3k: +(100 * hi / sum).toFixed(1),
        rms: +Math.sqrt(rms / d.length).toFixed(4),
        tailMs: Math.round(1000 * (d.findLastIndex(v => Math.abs(v) > 0.002) / 44100))
      };
    }

    // the version that was too shrill, rebuilt here for comparison
    function oldKatana(A) {
      const ac = A.ac;
      const s = A.noise(0.07), f = ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 2600;
      s.connect(f); const t = A.env(f, .26, .1); s.start(t); s.stop(t + .14);
      [[2400,.10,.42],[3570,.075,.52],[5310,.05,.34]].forEach(([hz,vol,dur],i) => {
        const o = ac.createOscillator(); o.type='sine'; o.frequency.value=hz;
        const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=hz; bp.Q.value=18;
        o.connect(bp); const t2 = A.env(bp,vol,dur,i*.004); o.start(t2); o.stop(t2+dur+.1);
      });
    }

    return {
      oldKatana:   await render(oldKatana),
      newCombo1:   await render(A => A.slice(0)),
      newCombo12:  await render(A => A.slice(11)),
      splat:       await render(A => A.splat())
    };
  });

  for (const [k, v] of Object.entries(out))
    console.log(k.padEnd(12), 'centroid', String(v.centroid).padStart(5) + ' Hz',
                '| peak', String(v.peakHz).padStart(5) + ' Hz',
                '| energy >3kHz', String(v.pctAbove3k).padStart(5) + '%',
                '| rms', v.rms, '| tail', v.tailMs + ' ms');
  await b.close();
})();
