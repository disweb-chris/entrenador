// Web Audio API — no external files needed
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep({ frequency = 880, duration = 0.15, volume = 0.4, type = "sine" } = {}) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// 3 quick warning beeps when 5s remain
export function playWarning() {
  beep({ frequency: 1046, duration: 0.1, volume: 0.5 });
  setTimeout(() => beep({ frequency: 1046, duration: 0.1, volume: 0.5 }), 180);
  setTimeout(() => beep({ frequency: 1046, duration: 0.1, volume: 0.5 }), 360);
}

// Long done beep when timer hits 0
export function playDone() {
  beep({ frequency: 523, duration: 0.12, volume: 0.6 });
  setTimeout(() => beep({ frequency: 659, duration: 0.12, volume: 0.6 }), 140);
  setTimeout(() => beep({ frequency: 784, duration: 0.35, volume: 0.7 }), 280);
}

export function vibrate(pattern = [100, 50, 100]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
