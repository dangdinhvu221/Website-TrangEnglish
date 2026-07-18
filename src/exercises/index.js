import { resolveBaseType } from '@data/exercise-types.js';
import { playSelectSound, reactToAnswer } from '@/exercises/feedback.js';
import { escapeHtml, withBase } from '@/utils.js';

function normalizeAnswer(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s*([,.!?])\s*/g, '$1')
    .replace(/[?.!,]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isCorrectWrite(userValue, item) {
  const user = normalizeAnswer(userValue);
  const answers = [item.answer, ...(item.accept ?? [])].map(normalizeAnswer);
  return answers.includes(user);
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * True if `image` is a URL or local file path (not emoji / plain text).
 * Supports: https://…, http://…, /images/…, ./…, data:image/…
 */
function isImageSrc(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (/^(https?:|data:image\/|blob:)/i.test(s)) return true;
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(s);
}

/** Render picture chase visual: <img> for URLs/paths, else emoji/text. */
function pictureVisualHtml(item) {
  const raw = String(item.image ?? '').trim();
  const src = isImageSrc(raw) && raw.startsWith('/') ? withBase(raw) : raw;
  const alt = item.imageAlt || item.answer || 'Exercise image';
  if (isImageSrc(raw)) {
    return `
      <div class="pic-image pic-image--photo">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />
      </div>`;
  }
  return `<div class="pic-image pic-image--emoji" aria-hidden="true">${escapeHtml(raw)}</div>`;
}

function feedbackHtml(ok, message) {
  return `<p class="ex-feedback ${ok ? 'is-ok' : 'is-bad'}" role="status">${escapeHtml(message)}</p>`;
}

function progressHtml(current, total) {
  return `
    <div class="ex-progress" aria-hidden="true">
      <span class="ex-progress__bar" style="width:${Math.round((current / total) * 100)}%"></span>
    </div>
    <p class="ex-progress__label">${current} / ${total}</p>
  `;
}

/* ——— Flip ——— */
function mountFlip(root, exercise) {
  const cards = exercise.cards ?? [];
  root.innerHTML = `
    <div class="flip-grid">
      ${cards
        .map(
          (card, i) => `
        <button type="button" class="flip-card" data-index="${i}" aria-pressed="false">
          <span class="flip-card__inner">
            <span class="flip-card__face flip-card__face--front">${escapeHtml(card.front)}</span>
            <span class="flip-card__face flip-card__face--back">${escapeHtml(card.back)}</span>
          </span>
        </button>
      `,
        )
        .join('')}
    </div>
    <p class="ex-hint">Tap a card to flip · Flip again to review</p>
  `;

  root.querySelectorAll('.flip-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      playSelectSound();
      const open = btn.classList.toggle('is-flipped');
      btn.setAttribute('aria-pressed', String(open));
    });
  });
}

/* ——— Picture ——— */
function mountPicture(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Done!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const options = shuffle(item.options);
    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <div class="pic-stage">
        ${pictureVisualHtml(item)}
        <div class="pic-options">
          ${options
            .map(
              (opt) =>
                `<button type="button" class="pic-option" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`,
            )
            .join('')}
        </div>
        <div data-feedback></div>
      </div>
    `;

    const img = root.querySelector('.pic-image img');
    if (img) {
      img.addEventListener('error', () => {
        img.replaceWith(
          Object.assign(document.createElement('span'), {
            className: 'pic-image__fallback',
            textContent: item.imageAlt || item.answer || 'Image unavailable',
          }),
        );
      });
    }
    root.querySelectorAll('.pic-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSelectSound();
        const ok = btn.dataset.answer === item.answer;
        root.querySelectorAll('.pic-option').forEach((b) => {
          b.disabled = true;
          if (b.dataset.answer === item.answer) b.classList.add('is-correct');
        });
        if (ok) {
          score += 1;
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-wrong');
        }
        root.querySelector('[data-feedback]').innerHTML = feedbackHtml(
          ok,
          ok ? 'Well done!' : `Answer: ${item.answer}`,
        );
        reactToAnswer(root, ok);
        setTimeout(() => {
          index += 1;
          render();
        }, ok ? 1300 : 1000);
      });
    });
  }

  render();
}

/* ——— Sentence (drag & drop floating words) ——— */
function mountSentence(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;
  let stopWander = null;

  function render() {
    stopWander?.();
    stopWander = null;

    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Finished!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const pool = shuffle(item.words).map((w, i) => ({
      w,
      id: `w-${index}-${i}`,
    }));

    let builtIds = [];
    let locked = false;
    let dragId = null;

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <div class="sent-game" data-sent-game>
        <div class="sent-drop" data-drop>
          <p class="sent-drop__hint" data-drop-hint>Drag words down here to build the sentence</p>
          <div class="sent-drop__row" data-slots></div>
        </div>

        <div class="sent-sky" data-sky aria-label="Floating words">
          ${pool
            .map(
              (p) => `
            <button type="button" class="sent-float"
              data-id="${escapeHtml(p.id)}"
              data-word="${escapeHtml(p.w)}"
              draggable="true">
              ${escapeHtml(p.w)}
            </button>`,
            )
            .join('')}
        </div>

        <div class="sent-actions btn-row">
          <button type="button" class="btn btn--outline" data-clear>Clear</button>
          <button type="button" class="btn btn--primary" data-check>Check</button>
        </div>
        <div data-feedback>
          <p class="sent-tip">Words drift around — hover to pause, then drag into the box above. Wrong? Press Clear.</p>
        </div>
      </div>
    `;

    const game = root.querySelector('[data-sent-game]');
    const sky = root.querySelector('[data-sky]');
    const slots = root.querySelector('[data-slots]');
    const drop = root.querySelector('[data-drop]');
    const hint = root.querySelector('[data-drop-hint]');
    const feedback = root.querySelector('[data-feedback]');
    const clearBtn = root.querySelector('[data-clear]');
    const checkBtn = root.querySelector('[data-check]');

    /** Make chips bounce around inside the sky. */
    function startWander() {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const chips = [...sky.querySelectorAll('.sent-float')];
      const w0 = sky.clientWidth || 320;
      const h0 = sky.clientHeight || 200;

      const movers = chips.map((el, i) => {
        const cw = el.offsetWidth || 64;
        const ch = el.offsetHeight || 36;
        const x = 8 + Math.random() * Math.max(8, w0 - cw - 16);
        const y = 8 + Math.random() * Math.max(8, h0 - ch - 16);
        // Lively drift — still catchable on hover
        const speed = reduceMotion ? 0 : 0.55 + Math.random() * 0.65;
        const angle = Math.random() * Math.PI * 2;
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.transform = `translate(${x}px, ${y}px) rotate(${-10 + Math.random() * 20}deg)`;
        return {
          el,
          x,
          y,
          vx: Math.cos(angle) * speed * (i % 2 === 0 ? 1 : -1),
          vy: Math.sin(angle) * speed,
          rot: -10 + Math.random() * 20,
          vr: reduceMotion ? 0 : -0.35 + Math.random() * 0.7,
        };
      });

      // Hover / press: freeze that chip so it can be dragged
      chips.forEach((el) => {
        el.addEventListener('pointerenter', () => {
          if (el.classList.contains('is-caught') || game.classList.contains('is-locked')) return;
          el.classList.add('is-paused');
        });
        el.addEventListener('pointerleave', () => {
          if (el.classList.contains('is-dragging')) return;
          el.classList.remove('is-paused');
        });
        el.addEventListener('pointerdown', () => {
          if (el.classList.contains('is-caught') || game.classList.contains('is-locked')) return;
          el.classList.add('is-paused');
        });
      });

      let rafId = 0;
      const tick = () => {
        const w = sky.clientWidth;
        const h = sky.clientHeight;
        movers.forEach((m) => {
          if (
            m.el.classList.contains('is-caught') ||
            m.el.classList.contains('is-dragging') ||
            m.el.classList.contains('is-paused') ||
            game.classList.contains('is-locked')
          ) {
            return;
          }
          const cw = m.el.offsetWidth;
          const ch = m.el.offsetHeight;
          m.x += m.vx;
          m.y += m.vy;
          m.rot += m.vr;

          if (m.x <= 4) {
            m.x = 4;
            m.vx = Math.abs(m.vx) || 0.55;
          } else if (m.x >= w - cw - 4) {
            m.x = w - cw - 4;
            m.vx = -Math.abs(m.vx) || -0.55;
          }
          if (m.y <= 4) {
            m.y = 4;
            m.vy = Math.abs(m.vy) || 0.55;
          } else if (m.y >= h - ch - 4) {
            m.y = h - ch - 4;
            m.vy = -Math.abs(m.vy) || -0.55;
          }

          // Frequent course changes so chips feel more lively
          if (Math.random() < 0.022) {
            m.vx += -0.22 + Math.random() * 0.44;
            m.vy += -0.22 + Math.random() * 0.44;
          }

          const sp = Math.hypot(m.vx, m.vy);
          const maxSp = 1.45;
          const minSp = 0.4;
          if (sp > maxSp) {
            m.vx = (m.vx / sp) * maxSp;
            m.vy = (m.vy / sp) * maxSp;
          }
          if (sp < minSp && !reduceMotion) {
            const a = Math.random() * Math.PI * 2;
            m.vx = Math.cos(a) * 0.75;
            m.vy = Math.sin(a) * 0.75;
          }

          m.el.style.transform = `translate(${m.x}px, ${m.y}px) rotate(${m.rot}deg)`;
        });
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }

    stopWander = startWander();

    function chipInSky(id) {
      return sky.querySelector(`.sent-float[data-id="${CSS.escape(id)}"]`);
    }

    function syncDrop() {
      hint.hidden = builtIds.length > 0;
      slots.innerHTML = builtIds
        .map((id) => {
          const chip = pool.find((p) => p.id === id);
          if (!chip) return '';
          return `
            <button type="button" class="sent-slot" data-id="${escapeHtml(id)}" data-word="${escapeHtml(chip.w)}" draggable="true">
              ${escapeHtml(chip.w)}
            </button>`;
        })
        .join('');

      slots.querySelectorAll('.sent-slot').forEach((el) => {
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
        el.addEventListener('click', () => {
          if (locked) return;
          removeFromBuilt(el.dataset.id);
        });
      });
    }

    function placeInBuilt(id, atIndex = null) {
      if (locked || builtIds.includes(id)) return;
      playSelectSound();
      const chip = chipInSky(id);
      if (chip) {
        chip.classList.add('is-caught');
        chip.setAttribute('aria-hidden', 'true');
        chip.tabIndex = -1;
        chip.draggable = false;
      }
      if (atIndex === null || atIndex < 0 || atIndex > builtIds.length) {
        builtIds.push(id);
      } else {
        builtIds.splice(atIndex, 0, id);
      }
      syncDrop();
    }

    function removeFromBuilt(id) {
      if (locked) return;
      builtIds = builtIds.filter((x) => x !== id);
      const chip = chipInSky(id);
      if (chip) {
        chip.classList.remove('is-caught');
        chip.removeAttribute('aria-hidden');
        chip.tabIndex = 0;
        chip.draggable = true;
      }
      syncDrop();
    }

    function clearAll() {
      locked = false;
      game.classList.remove('is-locked', 'is-wrong', 'is-ok');
      [...builtIds].forEach((id) => {
        const chip = chipInSky(id);
        if (chip) {
          chip.classList.remove('is-caught');
          chip.removeAttribute('aria-hidden');
          chip.tabIndex = 0;
          chip.draggable = true;
        }
      });
      builtIds = [];
      syncDrop();
      checkBtn.disabled = false;
      feedback.innerHTML =
        '<p class="sent-tip">Words drift slowly — hover to pause, then drag into the box above. Wrong? Press Clear.</p>';
    }

    function onDragStart(event) {
      if (locked) {
        event.preventDefault();
        return;
      }
      const el = event.currentTarget;
      dragId = el.dataset.id;
      event.dataTransfer.setData('text/plain', dragId);
      event.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
      game.classList.add('is-dragging');
    }

    function onDragEnd(event) {
      event.currentTarget.classList.remove('is-dragging');
      event.currentTarget.classList.remove('is-paused');
      game.classList.remove('is-dragging');
      drop.classList.remove('is-over');
      dragId = null;
    }

    sky.querySelectorAll('.sent-float').forEach((chip) => {
      chip.addEventListener('dragstart', onDragStart);
      chip.addEventListener('dragend', onDragEnd);
      chip.addEventListener('click', () => {
        if (locked || chip.classList.contains('is-caught')) return;
        placeInBuilt(chip.dataset.id);
      });
    });

    drop.addEventListener('dragover', (event) => {
      if (locked) return;
      event.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
      if (locked) return;
      const id = event.dataTransfer.getData('text/plain') || dragId;
      if (!id) return;
      if (builtIds.includes(id)) {
        builtIds = builtIds.filter((x) => x !== id);
      }
      placeInBuilt(id);
    });

    clearBtn.addEventListener('click', clearAll);

    checkBtn.addEventListener('click', () => {
      if (locked) return;
      if (!builtIds.length) {
        feedback.innerHTML = feedbackHtml(false, 'Drag some words into the sentence box first.');
        return;
      }
      playSelectSound();
      const user = builtIds
        .map((id) => pool.find((p) => p.id === id)?.w ?? '')
        .join(' ');
      const ok = normalizeAnswer(user) === normalizeAnswer(item.answer);

      if (ok) {
        score += 1;
        locked = true;
        game.classList.add('is-locked', 'is-ok');
        checkBtn.disabled = true;
        feedback.innerHTML = feedbackHtml(true, 'Perfect sentence!');
        reactToAnswer(root, true);
        setTimeout(() => {
          index += 1;
          render();
        }, 1300);
        return;
      }

      locked = true;
      game.classList.add('is-locked', 'is-wrong');
      checkBtn.disabled = true;
      feedback.innerHTML = `
        ${feedbackHtml(false, 'Not quite — stopped.')}
        <p class="sent-tip">Press <strong>Clear</strong> to catch the words and try again.</p>
      `;
      reactToAnswer(root, false);
    });

    syncDrop();
  }

  render();
}

/* ——— Match ——— */
function mountMatch(root, exercise) {
  const pairs = exercise.pairs ?? [];
  const left = pairs.map((p, i) => ({ text: p.left, id: i }));
  const right = shuffle(pairs.map((p, i) => ({ text: p.right, id: i })));
  let selectedLeft = null;
  let matched = new Set();
  let mistakes = 0;
  let lastMatchedId = null;
  let wrongId = null;

  function render() {
    const done = matched.size === pairs.length;
    const pct = Math.round((matched.size / Math.max(pairs.length, 1)) * 100);

    root.innerHTML = `
      <div class="match-game ${done ? 'is-done' : ''}">
        <div class="match-game__top">
          <div class="match-game__score">
            <span class="match-game__score-num">${matched.size}<small>/${pairs.length}</small></span>
            <span class="match-game__score-label">pairs matched</span>
          </div>
          <div class="match-game__meter" aria-hidden="true">
            <span class="match-game__meter-fill" style="width:${pct}%"></span>
          </div>
        </div>

        <div class="match-board">
          <div class="match-col match-col--left" data-side="left">
            <div class="match-col__label">Word</div>
            ${left
              .map((item) => {
                const state = matched.has(item.id)
                  ? 'is-matched'
                  : selectedLeft === item.id
                    ? 'is-selected'
                    : '';
                const pop = lastMatchedId === item.id ? ' is-pop' : '';
                return `
                  <button type="button"
                    class="match-item match-item--left ${state}${pop} match-pair--${item.id % 6}"
                    data-id="${item.id}" data-side="left"
                    ${matched.has(item.id) ? 'disabled' : ''}>
                    <span class="match-item__dot" aria-hidden="true"></span>
                    <span class="match-item__text">${escapeHtml(item.text)}</span>
                    ${matched.has(item.id) ? '<span class="match-item__check" aria-hidden="true">✓</span>' : ''}
                  </button>`;
              })
              .join('')}
          </div>

          <div class="match-bridge" aria-hidden="true">
            <span class="match-bridge__line"></span>
            <span class="match-bridge__node ${selectedLeft !== null ? 'is-active' : ''}"></span>
          </div>

          <div class="match-col match-col--right" data-side="right">
            <div class="match-col__label">Meaning</div>
            ${right
              .map((item) => {
                const state = matched.has(item.id)
                  ? 'is-matched'
                  : wrongId === item.id
                    ? 'is-wrong'
                    : '';
                const pop = lastMatchedId === item.id ? ' is-pop' : '';
                const dim =
                  selectedLeft !== null && !matched.has(item.id) ? ' is-target' : '';
                return `
                  <button type="button"
                    class="match-item match-item--right ${state}${pop}${dim} match-pair--${item.id % 6}"
                    data-id="${item.id}" data-side="right"
                    ${matched.has(item.id) ? 'disabled' : ''}>
                    <span class="match-item__text">${escapeHtml(item.text)}</span>
                    <span class="match-item__dot" aria-hidden="true"></span>
                    ${matched.has(item.id) ? '<span class="match-item__check" aria-hidden="true">✓</span>' : ''}
                  </button>`;
              })
              .join('')}
          </div>
        </div>

        <div class="match-game__foot" data-feedback>
          ${
            done
              ? `<div class="match-done">
                  <p class="match-done__title">${mistakes === 0 ? 'Awesome!' : 'Finished!'}</p>
                  <p class="match-done__sub">${mistakes === 0 ? 'All pairs matched — no mistakes!' : `${mistakes} mistake(s). Try again for a perfect score.`}</p>
                  <button type="button" class="btn btn--primary" data-restart>Play again</button>
                </div>`
              : selectedLeft !== null
                ? `<p class="match-hint match-hint--active">Left side selected — now pick the matching meaning on the right.</p>`
                : `<p class="match-hint">Tap a word on the left, then tap its match on the right.</p>`
          }
        </div>
      </div>
    `;

    lastMatchedId = null;
    wrongId = null;

    root.querySelector('[data-restart]')?.addEventListener('click', () => {
      matched = new Set();
      selectedLeft = null;
      mistakes = 0;
      right.splice(0, right.length, ...shuffle(pairs.map((p, i) => ({ text: p.right, id: i }))));
      render();
    });

    if (done) return;

    root.querySelectorAll('.match-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSelectSound();
        const id = Number(btn.dataset.id);
        const side = btn.dataset.side;
        if (side === 'left') {
          selectedLeft = id;
          render();
          return;
        }
        if (selectedLeft === null) {
          root.querySelector('[data-feedback]').innerHTML =
            '<p class="match-hint match-hint--warn">Pick a word on the left first.</p>';
          return;
        }
        if (selectedLeft === id) {
          matched.add(id);
          lastMatchedId = id;
          selectedLeft = null;
          reactToAnswer(root, true);
          render();
        } else {
          mistakes += 1;
          wrongId = id;
          reactToAnswer(root, false);
          render();
          setTimeout(() => {
            selectedLeft = null;
            wrongId = null;
            render();
          }, 550);
        }
      });
    });
  }

  render();
}

/* ——— Choice (text multiple choice) ——— */
function mountChoice(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Done!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const options = shuffle(item.options || []);
    const visual =
      item.image && String(item.image).trim()
        ? pictureVisualHtml({ image: item.image, imageAlt: item.imageAlt, answer: item.answer })
        : '';

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <div class="choice-stage">
        <p class="choice-prompt">${escapeHtml(item.prompt)}</p>
        ${visual}
        <div class="choice-options">
          ${options
            .map(
              (opt) =>
                `<button type="button" class="choice-option" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`,
            )
            .join('')}
        </div>
        <div data-feedback></div>
      </div>
    `;

    root.querySelectorAll('.choice-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSelectSound();
        const ok = normalizeAnswer(btn.dataset.answer) === normalizeAnswer(item.answer);
        root.querySelectorAll('.choice-option').forEach((b) => {
          b.disabled = true;
          if (normalizeAnswer(b.dataset.answer) === normalizeAnswer(item.answer)) {
            b.classList.add('is-correct');
          }
        });
        if (ok) {
          score += 1;
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-wrong');
        }
        root.querySelector('[data-feedback]').innerHTML = feedbackHtml(
          ok,
          ok ? 'Well done!' : `Answer: ${item.answer}`,
        );
        reactToAnswer(root, ok);
        setTimeout(() => {
          index += 1;
          render();
        }, ok ? 1300 : 1000);
      });
    });
  }

  render();
}

/* ——— True / False ——— */
function mountTrueFalse(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Finished!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const correct = Boolean(item.answer);

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <div class="tf-stage">
        <p class="tf-statement">${escapeHtml(item.statement || item.prompt || '')}</p>
        <div class="tf-options">
          <button type="button" class="tf-btn tf-btn--true" data-pick="true">True</button>
          <button type="button" class="tf-btn tf-btn--false" data-pick="false">False</button>
        </div>
        <div data-feedback></div>
      </div>
    `;

    root.querySelectorAll('.tf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSelectSound();
        const pick = btn.dataset.pick === 'true';
        const ok = pick === correct;
        root.querySelectorAll('.tf-btn').forEach((b) => {
          b.disabled = true;
          if ((b.dataset.pick === 'true') === correct) b.classList.add('is-correct');
        });
        if (ok) {
          score += 1;
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-wrong');
        }
        root.querySelector('[data-feedback]').innerHTML = feedbackHtml(
          ok,
          ok ? 'Correct!' : `Answer: ${correct ? 'True' : 'False'}`,
        );
        reactToAnswer(root, ok);
        setTimeout(() => {
          index += 1;
          render();
        }, ok ? 1300 : 1000);
      });
    });
  }

  render();
}

/* ——— Fill the blank ——— */
function mountBlank(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>All blanks done!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const sentence = escapeHtml(String(item.prompt || ''))
      .replace(/_{2,}/g, '<span class="blank-gap" aria-hidden="true">____</span>')
      .replace(/\(\s*\.\.\.\s*\)/g, '<span class="blank-gap" aria-hidden="true">____</span>');

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <form class="blank-form" autocomplete="off">
        <p class="blank-sentence">${sentence}</p>
        ${item.hint ? `<p class="write-hint"><span class="write-hint__label">Hint</span> ${escapeHtml(item.hint)}</p>` : ''}
        <label class="visually-hidden" for="blank-input">Missing word</label>
        <input id="blank-input" class="blank-input" type="text" required spellcheck="false" placeholder="Type the missing word…" />
        <button type="submit" class="btn btn--primary">Check</button>
        <div data-feedback></div>
      </form>
    `;

    const form = root.querySelector('.blank-form');
    const input = root.querySelector('#blank-input');
    const feedback = root.querySelector('[data-feedback]');
    input.focus();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      playSelectSound();
      const ok = isCorrectWrite(input.value, item);
      if (ok) score += 1;
      input.disabled = true;
      form.querySelector('button[type="submit"]').disabled = true;

      if (ok) {
        feedback.innerHTML = `
          ${feedbackHtml(true, 'Correct!')}
          <button type="button" class="btn btn--primary" data-next>Continue</button>
        `;
      } else {
        feedback.innerHTML = `
          ${feedbackHtml(false, 'Not quite — see the correct answer below.')}
          <div class="write-answer" role="status">
            <span class="write-answer__label">Correct answer</span>
            <strong class="write-answer__text">${escapeHtml(item.answer)}</strong>
          </div>
          <button type="button" class="btn btn--primary" data-next>Continue</button>
        `;
      }
      reactToAnswer(root, ok);

      feedback.querySelector('[data-next]')?.addEventListener('click', () => {
        index += 1;
        render();
      });
    });
  }

  render();
}

/* ——— Put in order ——— */
function mountOrder(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Ordering done!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const parts = (item.parts || []).map((text, i) => ({ text, id: `p-${index}-${i}` }));
    const pool = shuffle(parts);
    let builtIds = [];
    let locked = false;

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <div class="order-game">
        <p class="order-hint">Tap the pieces in the correct order</p>
        <div class="order-built" data-built></div>
        <div class="order-pool" data-pool>
          ${pool
            .map(
              (p) => `
            <button type="button" class="order-chip" data-id="${escapeHtml(p.id)}" data-text="${escapeHtml(p.text)}">
              ${escapeHtml(p.text)}
            </button>`,
            )
            .join('')}
        </div>
        <div class="order-actions btn-row">
          <button type="button" class="btn btn--outline" data-clear>Clear</button>
          <button type="button" class="btn btn--primary" data-check>Check</button>
        </div>
        <div data-feedback></div>
      </div>
    `;

    const builtEl = root.querySelector('[data-built]');
    const poolEl = root.querySelector('[data-pool]');
    const feedback = root.querySelector('[data-feedback]');

    function sync() {
      builtEl.innerHTML = builtIds.length
        ? builtIds
            .map((id, i) => {
              const part = parts.find((p) => p.id === id);
              if (!part) return '';
              return `<button type="button" class="order-chip order-chip--built" data-built-id="${escapeHtml(id)}">
                <span class="order-chip__n">${i + 1}</span>${escapeHtml(part.text)}
              </button>`;
            })
            .join('')
        : '<p class="order-built__empty">Your order appears here</p>';

      poolEl.querySelectorAll('.order-chip').forEach((chip) => {
        chip.hidden = builtIds.includes(chip.dataset.id);
        chip.disabled = locked;
      });

      builtEl.querySelectorAll('[data-built-id]').forEach((chip) => {
        chip.disabled = locked;
        chip.addEventListener('click', () => {
          if (locked) return;
          playSelectSound();
          builtIds = builtIds.filter((id) => id !== chip.dataset.builtId);
          sync();
        });
      });
    }

    poolEl.querySelectorAll('.order-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (locked || builtIds.includes(chip.dataset.id)) return;
        playSelectSound();
        builtIds.push(chip.dataset.id);
        sync();
      });
    });

    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      if (locked) return;
      builtIds = [];
      feedback.innerHTML = '';
      sync();
    });

    root.querySelector('[data-check]')?.addEventListener('click', () => {
      if (locked) return;
      playSelectSound();
      const user = builtIds
        .map((id) => parts.find((p) => p.id === id)?.text || '')
        .join(' / ');
      const answer = (item.answer || parts.map((p) => p.text).join(' / ')).trim();
      const ok = normalizeAnswer(user) === normalizeAnswer(answer);
      locked = true;
      if (ok) score += 1;
      feedback.innerHTML = ok
        ? `${feedbackHtml(true, 'Correct order!')}<button type="button" class="btn btn--primary" data-next>Continue</button>`
        : `${feedbackHtml(false, `Right order: ${answer}`)}<button type="button" class="btn btn--primary" data-next>Continue</button>`;
      reactToAnswer(root, ok);
      sync();
      feedback.querySelector('[data-next]')?.addEventListener('click', () => {
        index += 1;
        render();
      });
    });

    sync();
  }

  render();
}

/* ——— Write ——— */
function mountWrite(root, exercise) {
  const items = exercise.items ?? [];
  let index = 0;
  let score = 0;

  function render() {
    if (index >= items.length) {
      root.innerHTML = `
        <div class="ex-done">
          <h3>Writing done!</h3>
          <p>${score}/${items.length} correct.</p>
          <button type="button" class="btn btn--primary" data-restart>Try again</button>
        </div>
      `;
      root.querySelector('[data-restart]')?.addEventListener('click', () => {
        index = 0;
        score = 0;
        render();
      });
      return;
    }

    const item = items[index];
    const hint = item.hint
      ? `<p class="write-hint"><span class="write-hint__label">Hint</span> ${escapeHtml(item.hint)}</p>`
      : '';

    root.innerHTML = `
      ${progressHtml(index + 1, items.length)}
      <form class="write-form" autocomplete="off">
        <label class="write-prompt" for="write-input">${escapeHtml(item.prompt)}</label>
        ${hint}
        <input id="write-input" class="write-input" type="text" required spellcheck="false" placeholder="Type your answer…" />
        <button type="submit" class="btn btn--primary">Check</button>
        <div data-feedback></div>
      </form>
    `;

    const form = root.querySelector('.write-form');
    const input = root.querySelector('#write-input');
    const feedback = root.querySelector('[data-feedback]');
    input.focus();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      playSelectSound();
      const ok = isCorrectWrite(input.value, item);
      if (ok) score += 1;
      input.disabled = true;
      form.querySelector('button[type="submit"]').disabled = true;

      if (ok) {
        feedback.innerHTML = `
          ${feedbackHtml(true, 'Correct!')}
          <button type="button" class="btn btn--primary" data-next>Continue</button>
        `;
      } else {
        feedback.innerHTML = `
          ${feedbackHtml(false, 'Not quite — see the correct answer below.')}
          <div class="write-answer" role="status">
            <span class="write-answer__label">Correct answer</span>
            <strong class="write-answer__text">${escapeHtml(item.answer)}</strong>
          </div>
          <button type="button" class="btn btn--primary" data-next>Continue</button>
        `;
      }
      reactToAnswer(root, ok);

      feedback.querySelector('[data-next]')?.addEventListener('click', () => {
        index += 1;
        render();
      });
    });
  }

  render();
}

const mounts = {
  flip: mountFlip,
  picture: mountPicture,
  choice: mountChoice,
  truefalse: mountTrueFalse,
  sentence: mountSentence,
  order: mountOrder,
  match: mountMatch,
  write: mountWrite,
  blank: mountBlank,
};

/** Mount an interactive exercise into a container element. */
export function mountExercise(container, exercise) {
  const base = resolveBaseType(exercise);
  const mount = base ? mounts[base] : null;
  if (!mount) {
    container.innerHTML = `<p class="ex-hint">Unsupported exercise type: ${escapeHtml(exercise?.type || '?')}</p>`;
    return;
  }
  mount(container, exercise);
}
