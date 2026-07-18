/**
 * Light background music while an exercise is open.
 * Procedural Web Audio loop (no audio files / licensing).
 */

const STORAGE_KEY = 'trang-english-bg-music';

let audioCtx = null;
let masterGain = null;
let duckGain = null;
let playing = false;
let timerId = 0;
let step = 0;

/** Cheerful 16-step loop (≈ 100 BPM): melody + soft pulse */
const MELODY = [
  523.25, 587.33, 659.25, 783.99, // C5 D5 E5 G5
  659.25, 587.33, 523.25, 0,
  392.0, 523.25, 659.25, 587.33, // G4 C5 E5 D5
  523.25, 659.25, 783.99, 1046.5, // C5 E5 G5 C6
];

const BASS = [
  130.81, 0, 0, 0, // C3
  164.81, 0, 0, 0, // E3
  196.0, 0, 0, 0, // G3
  146.83, 0, 174.61, 0, // D3 F3
];

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function ensureGraph(ctx) {
  if (masterGain && duckGain) return;
  masterGain = ctx.createGain();
  duckGain = ctx.createGain();
  duckGain.gain.value = 1;
  masterGain.gain.value = 0;
  duckGain.connect(masterGain);
  masterGain.connect(ctx.destination);
}

function playNote(ctx, freq, time, dur, type, gainValue) {
  if (!freq) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(gain);
  gain.connect(duckGain);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function playTick(ctx, time, bright) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(bright ? 2400 : 180, time);
  gain.gain.setValueAtTime(bright ? 0.045 : 0.07, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + (bright ? 0.06 : 0.12));
  osc.connect(gain);
  gain.connect(duckGain);
  osc.start(time);
  osc.stop(time + 0.14);
}

function scheduleStep() {
  const ctx = getCtx();
  if (!ctx || !playing) return;
  ensureGraph(ctx);

  const t0 = ctx.currentTime + 0.02;
  const stepDur = 0.15; // ~100 BPM sixteenth-ish feel in pairs
  const i = step % 16;

  const mel = MELODY[i];
  const bass = BASS[i];
  playNote(ctx, mel, t0, 0.13, 'triangle', 0.11);
  playNote(ctx, bass, t0, 0.18, 'sine', 0.08);

  if (i % 4 === 0) playTick(ctx, t0, false);
  if (i % 4 === 2) playTick(ctx, t0, true);

  step += 1;
  timerId = window.setTimeout(scheduleStep, stepDur * 1000);
}

export function isMusicEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMusicEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isMusicPlaying() {
  return playing;
}

/** Softly lower music while SFX play. */
export function duckBackgroundMusic(ms = 900) {
  const ctx = getCtx();
  if (!ctx || !duckGain || !playing) return;
  const now = ctx.currentTime;
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setValueAtTime(duckGain.gain.value, now);
  duckGain.gain.linearRampToValueAtTime(0.22, now + 0.04);
  duckGain.gain.linearRampToValueAtTime(1, now + ms / 1000);
}

export function startExerciseMusic() {
  if (!isMusicEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  ensureGraph(ctx);
  if (playing) return;

  playing = true;
  step = 0;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value || 0.0001, now);
  masterGain.gain.linearRampToValueAtTime(1.15, now + 0.35);
  scheduleStep();
}

export function stopExerciseMusic() {
  if (!playing && !timerId) return;
  playing = false;
  window.clearTimeout(timerId);
  timerId = 0;
  const ctx = audioCtx;
  if (ctx && masterGain) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
  }
}

/** Toggle on/off; returns new enabled state. */
export function toggleExerciseMusic() {
  const next = !isMusicEnabled();
  setMusicEnabled(next);
  if (next) startExerciseMusic();
  else stopExerciseMusic();
  return next;
}
