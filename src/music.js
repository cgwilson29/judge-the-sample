// Original synthwave background loop, generated live with the Web Audio API (no audio files).
// 4-bar minor progression (Am – F – Dm – E) at 100 BPM: pulsing bass, arpeggio with echo,
// slow pad, soft kick and hi-hat. Composed for this app.

const BPM = 100;
const STEP = 60 / BPM / 4; // one 16th note, seconds
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.15; // seconds

// [bass root, chord tones] as MIDI note numbers
const BARS = [
  [45, [57, 60, 64]], // A minor
  [41, [53, 57, 60]], // F major
  [38, [50, 53, 57]], // D minor
  [40, [52, 56, 59]], // E major
];
const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3]; // indices into the extended chord
const BASS_OCT = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12]; // octave jumps

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createMusic() {
  let ctx = null;
  let master, bus, delaySend, noiseBuf;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let volume = 0.5;
  let running = false;
  let wanted = false; // last request from the user: play (true) or stop (false)
  let starting = null; // shared promise while the browser is unlocking audio

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    bus = ctx.createGain();
    bus.gain.value = 0.8;
    bus.connect(master);

    // Echo for the arpeggio: dotted-8th delay with filtered feedback.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    delaySend = ctx.createGain();
    delaySend.gain.value = 0.45;
    delaySend.connect(delay);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(bus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(gainNode, t, a, peak, hold, r) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.setValueAtTime(peak, t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    return t + a + hold + r + 0.05;
  }

  function bass(t, midi) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz(midi);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + STEP * 0.9);
    const g = ctx.createGain();
    o.connect(f).connect(g).connect(bus);
    o.start(t);
    o.stop(env(g, t, 0.005, 0.32, STEP * 0.4, STEP * 0.5));
  }

  function arp(t, midi) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = hz(midi);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 3200;
    const g = ctx.createGain();
    o.connect(f).connect(g);
    g.connect(bus);
    g.connect(delaySend);
    o.start(t);
    o.stop(env(g, t, 0.004, 0.07, STEP * 0.3, STEP * 0.7));
  }

  function pad(t, notes) {
    const dur = STEP * 16;
    for (const m of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(m);
        o.detune.value = detune;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 1100;
        const g = ctx.createGain();
        o.connect(f).connect(g).connect(bus);
        o.start(t);
        o.stop(env(g, t, 1.2, 0.022, dur - 2.0, 0.8));
      }
    }
  }

  function kick(t) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(env(g, t, 0.003, 0.45, 0.02, 0.22));
  }

  function hat(t) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(bus);
    s.start(t);
    s.stop(env(g, t, 0.002, 0.05, 0.01, 0.05));
  }

  function scheduleStep(t, s) {
    const bar = Math.floor(s / 16) % BARS.length;
    const i = s % 16;
    const [root, chord] = BARS[bar];
    const ext = [...chord, chord[0] + 12, chord[1] + 12];
    if (i === 0) pad(t, chord);
    bass(t, root + BASS_OCT[i]);
    arp(t, ext[ARP[i]] + 12);
    if (i % 4 === 0) kick(t);
    if (i % 4 === 2) hat(t);
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(nextTime, step);
      nextTime += STEP;
      step = (step + 1) % (16 * BARS.length);
    }
  }

  return {
    get running() {
      return running;
    },
    start() {
      wanted = true;
      if (running) return Promise.resolve();
      if (!starting) {
        if (!ctx) build();
        starting = ctx.resume().finally(() => {
          starting = null;
        });
      }
      return starting.then(() => {
        if (!wanted || running) return;
        begin();
      });
    },
    stop() {
      wanted = false;
      if (!running || !ctx) return;
      running = false;
      const g = master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      clearInterval(timer);
      timer = null;
      setTimeout(() => {
        if (!running) ctx.suspend();
      }, 500);
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (ctx && running) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
  };

  // Fade in and start the look-ahead scheduler (called once the browser has unlocked audio).
  function begin() {
    running = true;
    nextTime = ctx.currentTime + 0.05;
    const g = master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
    timer = setInterval(scheduler, LOOKAHEAD_MS);
    scheduler();
  }
}
