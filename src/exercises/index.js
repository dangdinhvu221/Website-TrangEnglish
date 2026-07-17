import { escapeHtml } from '@/utils.js';

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
  const src = String(item.image ?? '').trim();
  const alt = item.imageAlt || item.answer || 'Exercise image';
  if (isImageSrc(src)) {
    return `
      <div class="pic-image pic-image--photo">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />
      </div>`;
  }
  return `<div class="pic-image pic-image--emoji" aria-hidden="true">${escapeHtml(src)}</div>`;
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
        setTimeout(() => {
          index += 1;
          render();
        }, 900);
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
          <p class="sent-tip">Words drift slowly — hover to pause, then drag into the box above. Wrong? Press Clear.</p>
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

    /** Make chips bounce around inside the sky (slow). */
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
        // Slow drift — easy to point and catch
        const speed = reduceMotion ? 0 : 0.18 + Math.random() * 0.22;
        const angle = Math.random() * Math.PI * 2;
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.transform = `translate(${x}px, ${y}px) rotate(${-6 + Math.random() * 12}deg)`;
        return {
          el,
          x,
          y,
          vx: Math.cos(angle) * speed * (i % 2 === 0 ? 1 : -1),
          vy: Math.sin(angle) * speed,
          rot: -6 + Math.random() * 12,
          vr: reduceMotion ? 0 : -0.12 + Math.random() * 0.24,
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
            m.vx = Math.abs(m.vx) || 0.2;
          } else if (m.x >= w - cw - 4) {
            m.x = w - cw - 4;
            m.vx = -Math.abs(m.vx) || -0.2;
          }
          if (m.y <= 4) {
            m.y = 4;
            m.vy = Math.abs(m.vy) || 0.2;
          } else if (m.y >= h - ch - 4) {
            m.y = h - ch - 4;
            m.vy = -Math.abs(m.vy) || -0.2;
          }

          // Rare gentle course change
          if (Math.random() < 0.008) {
            m.vx += -0.08 + Math.random() * 0.16;
            m.vy += -0.08 + Math.random() * 0.16;
          }

          const sp = Math.hypot(m.vx, m.vy);
          const maxSp = 0.55;
          const minSp = 0.12;
          if (sp > maxSp) {
            m.vx = (m.vx / sp) * maxSp;
            m.vy = (m.vy / sp) * maxSp;
          }
          if (sp < minSp && !reduceMotion) {
            const a = Math.random() * Math.PI * 2;
            m.vx = Math.cos(a) * 0.28;
            m.vy = Math.sin(a) * 0.28;
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
        setTimeout(() => {
          index += 1;
          render();
        }, 1000);
        return;
      }

      locked = true;
      game.classList.add('is-locked', 'is-wrong');
      checkBtn.disabled = true;
      feedback.innerHTML = `
        ${feedbackHtml(false, 'Not quite — stopped.')}
        <p class="sent-tip">Press <strong>Clear</strong> to catch the words and try again.</p>
      `;
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
          render();
        } else {
          mistakes += 1;
          wrongId = id;
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
  sentence: mountSentence,
  match: mountMatch,
  write: mountWrite,
};

/** Mount an interactive exercise into a container element. */
export function mountExercise(container, exercise) {
  const mount = mounts[exercise.type];
  if (!mount) {
    container.innerHTML = `<p class="ex-hint">Unsupported exercise type: ${escapeHtml(exercise.type)}</p>`;
    return;
  }
  mount(container, exercise);
}
