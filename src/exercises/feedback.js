/**
 * Shared answer reactions: fireworks + applause on correct, shake + buzz on wrong.
 * Sounds are synthesized with Web Audio (no audio files required).
 */

import { duckBackgroundMusic } from '@/exercises/bg-music.js';

let audioCtx = null;

function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function preferReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Soft noise burst — reads as a short clap / cheer. */
function noiseBurst(ctx, time, duration, gainValue) {
  const size = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(time);
  src.stop(time + duration);
}

function tone(ctx, { freq, time, dur, type = 'triangle', gainValue = 0.08 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + dur);
}

function playApplause() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(ctx, { freq, time: t0 + i * 0.07, dur: 0.25, type: 'triangle', gainValue: 0.2 });
  });
  for (let i = 0; i < 8; i += 1) {
    noiseBurst(ctx, t0 + 0.05 + i * 0.055, 0.12 + Math.random() * 0.06, 0.1 + Math.random() * 0.05);
  }
}

function playFailBuzz() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.35);
  gain.gain.setValueAtTime(0.16, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);
  noiseBurst(ctx, t0, 0.18, 0.1);
}

/** Short tap when the learner picks / places an answer. */
export function playSelectSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  // Bright two-note “pop”
  tone(ctx, { freq: 880, time: t0, dur: 0.07, type: 'sine', gainValue: 0.14 });
  tone(ctx, { freq: 1174.66, time: t0 + 0.04, dur: 0.08, type: 'triangle', gainValue: 0.11 });
}

/** Prefer the lesson panel shell for shake / fail flash. */
function reactionHost(host) {
  return host?.closest?.('.ex-panel') || host;
}

function ensurePanelLayer(host) {
  let layer = host.querySelector(':scope > .ex-react-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ex-react-layer';
    layer.setAttribute('aria-hidden', 'true');
    host.appendChild(layer);
  }
  return layer;
}

/**
 * Full-viewport DOM fireworks — always on top, hard to miss.
 * Uses CSS animated particles (more reliable than canvas in nested panels).
 */
function runFireworks() {
  // Remove any previous celebration still on screen
  document.querySelectorAll('.ex-fireworks').forEach((el) => el.remove());

  const root = document.createElement('div');
  root.className = 'ex-fireworks';
  root.setAttribute('aria-hidden', 'true');

  const colors = ['#f4c430', '#ff6b4a', '#3d9b7a', '#4aa3e0', '#ff9f1c', '#ffffff', '#e85d9a'];
  const reduced = preferReducedMotion();
  const count = reduced ? 36 : 72;

  // Multiple burst origins across the viewport
  const origins = reduced
    ? [{ x: 50, y: 42 }]
    : [
        { x: 50, y: 38 },
        { x: 22, y: 48 },
        { x: 78, y: 46 },
      ];

  origins.forEach((origin, oi) => {
    const burst = document.createElement('div');
    burst.className = 'ex-fireworks__burst';
    burst.style.setProperty('--ox', `${origin.x}vw`);
    burst.style.setProperty('--oy', `${origin.y}vh`);
    burst.style.animationDelay = `${oi * 0.12}s`;

    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('span');
      p.className = 'ex-fireworks__spark';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 28 + Math.random() * 52;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.style.setProperty('--dx', `${dx}vmin`);
      p.style.setProperty('--dy', `${dy}vmin`);
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--s', `${6 + Math.random() * 8}px`);
      p.style.setProperty('--r', `${Math.random() * 360}deg`);
      p.style.animationDelay = `${oi * 0.12 + Math.random() * 0.15}s`;
      if (i % 5 === 0) p.classList.add('ex-fireworks__spark--long');
      burst.appendChild(p);
    }
    root.appendChild(burst);
  });

  // Big “Great!” badge in the center
  const badge = document.createElement('div');
  badge.className = 'ex-fireworks__badge';
  badge.textContent = '🎉 Great!';
  root.appendChild(badge);

  document.body.appendChild(root);

  window.setTimeout(
    () => {
      root.classList.add('is-done');
      window.setTimeout(() => root.remove(), 350);
    },
    reduced ? 900 : 1800,
  );
}

function runFailFlash(host) {
  host.classList.remove('ex-react--ok');
  host.classList.add('ex-react--bad');
  const layer = ensurePanelLayer(host);
  layer.querySelectorAll('.ex-react-fail').forEach((el) => el.remove());

  const flash = document.createElement('div');
  flash.className = 'ex-react-fail';
  flash.innerHTML = `
    <span class="ex-react-fail__icon" aria-hidden="true">✕</span>
    <span class="ex-react-fail__text">Try again</span>
  `;
  layer.appendChild(flash);

  window.setTimeout(() => {
    flash.remove();
    host.classList.remove('ex-react--bad');
    if (!layer.querySelector('.ex-react-fail')) layer.remove();
  }, preferReducedMotion() ? 500 : 900);
}

/**
 * Play success/fail reaction on an exercise root element.
 * @param {HTMLElement} host
 * @param {boolean} ok
 */
export function reactToAnswer(host, ok) {
  const el = reactionHost(host);
  if (!el) return;
  duckBackgroundMusic(ok ? 1100 : 800);
  if (ok) {
    el.classList.remove('ex-react--bad');
    el.classList.add('ex-react--ok');
    playApplause();
    runFireworks();
    window.setTimeout(() => el.classList.remove('ex-react--ok'), 1400);
  } else {
    playFailBuzz();
    runFailFlash(el);
  }
}
