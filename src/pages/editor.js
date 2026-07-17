import catalog from '../../data/lessons.json';
import { exerciseTypes } from '../../data/exercise-types.js';
import { site } from '../../data/site.js';
import { mountChrome } from '../components/chrome.js';
import { escapeHtml, setTitle } from '../utils.js';

mountChrome();
setTitle('Lesson Editor', site);

const STORAGE_KEY = 'trang-english-lessons-draft';
const TYPE_LIST = Object.values(exerciseTypes);
const API_URL = '/api/lessons';

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function loadState() {
  // Prefer file catalog; clear old browser draft so it cannot override disk.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return clone(catalog);
}

/** Ghi thẳng vào data/lessons.json qua API Vite (npm run dev / preview). */
async function persistState({ silent = false } = {}) {
  const payload = {
    levels: state.levels.filter((l) => !unsavedLevelIds.has(l.id)),
    lessons: state.lessons.filter((l) => !unsavedLessonIds.has(l.id)),
  };
  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, null, 2),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result.ok === false) {
      throw new Error(result.error || `HTTP ${res.status}`);
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (!silent) {
      setStatus('Đã lưu vào data/lessons.json.', 'ok');
    }
    return true;
  } catch (error) {
    const msg = error?.message || String(error);
    setStatus(`Không ghi được data/lessons.json (${msg}). Hãy chạy npm run dev.`, 'warn');
    if (!silent) {
      notify('Không ghi được data/lessons.json — hãy chạy npm run dev.', 'warn', { duration: 4200 });
    }
    return false;
  }
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `item-${Date.now()}`;
}

function uniqueId(base, existingIds) {
  let id = slugify(base);
  if (!existingIds.has(id)) return id;
  let n = 2;
  while (existingIds.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });
}

/** Nén ảnh để lessons.json không quá nặng (SVG giữ nguyên). */
async function fileToImageSrc(file) {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return raw;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 720;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(type, 0.84));
    };
    img.onerror = () => resolve(raw);
    img.src = raw;
  });
}

function guessAnswerFromFilename(name) {
  return slugify(String(name || '').replace(/\.[^.]+$/, '')) || 'answer';
}

function appendLinesToTextarea(textarea, newLines) {
  const current = textarea.value.trim();
  const block = newLines.join('\n');
  textarea.value = current ? `${current}\n${block}` : block;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Parse quick lines for each exercise type → structured data */
const parsers = {
  flip(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [front, ...rest] = line.split('|');
        return { front: front.trim(), back: rest.join('|').trim() };
      })
      .filter((c) => c.front && c.back);
  },
  picture(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const image = parts[0] || '';
        const answer = parts[1] || '';
        const options = (parts[2] || answer)
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        const imageAlt = parts[3] || '';
        const item = { image, options, answer };
        if (imageAlt) item.imageAlt = imageAlt;
        return item;
      })
      .filter((i) => i.image && i.answer && i.options.length);
  },
  sentence(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, ...rest] = line.split('|');
        const answer = rest.join('|').trim();
        const words = left
          .split(/\s+/)
          .map((w) => w.trim())
          .filter(Boolean);
        return { words, answer };
      })
      .filter((i) => i.words.length && i.answer);
  },
  match(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, ...rest] = line.split('|');
        return { left: left.trim(), right: rest.join('|').trim() };
      })
      .filter((p) => p.left && p.right);
  },
  write(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const item = {
          prompt: parts[0] || '',
          hint: parts[1] || '',
          answer: parts[2] || '',
        };
        if (parts[3]) {
          item.accept = parts[3]
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean);
        }
        return item;
      })
      .filter((i) => i.prompt && i.answer);
  },
};

const serializers = {
  flip(cards = []) {
    return cards.map((c) => `${c.front} | ${c.back}`).join('\n');
  },
  picture(items = []) {
    return items
      .map((i) => {
        const opts = (i.options || []).join(', ');
        const alt = i.imageAlt ? ` | ${i.imageAlt}` : '';
        return `${i.image} | ${i.answer} | ${opts}${alt}`;
      })
      .join('\n');
  },
  sentence(items = []) {
    return items.map((i) => `${(i.words || []).join(' ')} | ${i.answer}`).join('\n');
  },
  match(pairs = []) {
    return pairs.map((p) => `${p.left} | ${p.right}`).join('\n');
  },
  write(items = []) {
    return items
      .map((i) => {
        const accept = i.accept?.length ? ` | ${i.accept.join(', ')}` : '';
        return `${i.prompt} | ${i.hint || ''} | ${i.answer}${accept}`;
      })
      .join('\n');
  },
};

const TYPE_HELP = {
  flip: 'Mỗi dòng: mặt trước | mặt sau\nVí dụ: A a | ay',
  picture:
    'Mỗi dòng: ảnh | đáp án | lựa chọn1, lựa chọn2 | mô tả ảnh (tuỳ chọn)\nHoặc bấm “Chọn ảnh từ máy” để thêm file.\nẢnh: emoji, /images/file.png, https://…, hoặc file đã chọn',
  sentence: 'Mỗi dòng: các từ (cách nhau bởi dấu cách) | câu đúng\nVí dụ: is It blue | It is blue',
  match: 'Mỗi dòng: trái | phải\nVí dụ: red | like a strawberry',
  write:
    'Mỗi dòng: câu hỏi | gợi ý | đáp án | đáp án phụ (tuỳ chọn, cách nhau bởi dấu phẩy)\nVí dụ: Write the word for 3 | Starts with th… | three',
};

let state = loadState();
let view = { name: 'home' }; // home | level | lesson  (+ isNew?)
let homeTab = 'lessons'; // levels | lessons — mặc định tab Lessons
let selectedLevelId = state.levels[0]?.id ?? '';
let statusMsg = {
  text: 'Chạy npm run dev — thêm/sửa/xoá sẽ ghi thẳng vào data/lessons.json.',
  kind: '',
};
/** Lesson mới chưa bấm Lưu — Huỷ / Quay lại sẽ xoá; chưa ghi vào file. */
const unsavedLessonIds = new Set();
/** Level mới chưa bấm Lưu. */
const unsavedLevelIds = new Set();
/** Highlight ngắn trên danh sách sau khi thêm. */
let highlightLessonId = '';
/** Index bài tập đang mở trong form lesson (chỉ hiện 1 panel). */
let openExerciseIndex = 0;
/** Bản gốc khi mở Sửa — dùng để Huỷ / Quay lại hoàn tác. */
let lessonEditSnapshot = null;
/** Gỡ listener scroll / nút lên đầu khi rời form lesson. */
let teardownLessonChrome = null;

const main = document.getElementById('main');

/** Thông báo gọn (toast) — thay popup modal */
let toastHost = null;

function ensureToastHost() {
  if (!toastHost || !document.body.contains(toastHost)) {
    toastHost = document.createElement('div');
    toastHost.className = 'ed-toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

function dismissToast(el) {
  if (!el?.isConnected) return;
  el.classList.remove('is-open');
  window.setTimeout(() => el.remove(), 220);
}

/** Thông báo tự ẩn. */
function notify(message, kind = 'ok', { duration = 2800 } = {}) {
  const host = ensureToastHost();
  const el = document.createElement('div');
  el.className = `ed-toast ed-toast--${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="ed-toast__mark" aria-hidden="true"></span>
    <p class="ed-toast__text">${escapeHtml(message)}</p>
  `;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-open'));
  window.setTimeout(() => dismissToast(el), duration);
}

/** Xác nhận dạng toast có nút (không dùng modal). */
function ask(message, { confirmLabel = 'Đồng ý', cancelLabel = 'Huỷ', danger = false } = {}) {
  return new Promise((resolve) => {
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = `ed-toast ed-toast--ask ${danger ? 'ed-toast--danger' : 'ed-toast--info'}`;
    el.setAttribute('role', 'alertdialog');
    el.innerHTML = `
      <span class="ed-toast__mark" aria-hidden="true"></span>
      <p class="ed-toast__text">${escapeHtml(message)}</p>
      <div class="ed-toast__actions">
        <button type="button" class="ed-toast__btn" data-toast-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="ed-toast__btn ed-toast__btn--primary ${danger ? 'is-danger' : ''}" data-toast-ok>${escapeHtml(confirmLabel)}</button>
      </div>
    `;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-open'));

    const finish = (value) => {
      window.removeEventListener('keydown', onKey);
      dismissToast(el);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    el.querySelector('[data-toast-ok]')?.addEventListener('click', () => finish(true));
    el.querySelector('[data-toast-cancel]')?.addEventListener('click', () => finish(false));
    window.addEventListener('keydown', onKey);
    el.querySelector('[data-toast-ok]')?.focus();
  });
}

/** Ghi meta + bài đang mở từ form vào object lesson (trước khi paint lại). */
function syncLessonDraftFromForm(form, lesson, exerciseIndex) {
  if (!form || !lesson) return;
  const fd = new FormData(form);
  lesson.levelId = String(fd.get('levelId') || lesson.levelId || '').trim();
  lesson.title = String(fd.get('title') || lesson.title || '').trim();
  lesson.summary = String(fd.get('summary') || '').trim();
  lesson.body = String(fd.get('body') || '').trim();
  lesson.tip = String(fd.get('tip') || '').trim();

  if (!lesson.exercises?.length) return;
  const index = Math.max(0, Math.min(exerciseIndex, lesson.exercises.length - 1));
  const ex = lesson.exercises[index];
  if (!ex) return;

  const type = String(fd.get(`ex-type-${index}`) || ex.type);
  const lines = String(fd.get(`ex-lines-${index}`) || '');
  const next = applyExerciseFromForm(ex, type, lines);
  next.id = ex.id || `${lesson.id}-${type}-${index + 1}`;
  next.title = String(fd.get(`ex-title-${index}`) || '').trim() || next.title;
  next.prompt = String(fd.get(`ex-prompt-${index}`) || '').trim();
  lesson.exercises[index] = next;
}

function clampOpenExercise(lesson) {
  const n = lesson?.exercises?.length ?? 0;
  if (n <= 0) {
    openExerciseIndex = 0;
    return;
  }
  openExerciseIndex = Math.max(0, Math.min(openExerciseIndex, n - 1));
}

function setStatus(text, kind = '') {
  statusMsg = { text, kind };
}

function goHome(tab = homeTab) {
  homeTab = tab;
  view = { name: 'home' };
  paint();
}

/** Huỷ bản đang tạo (lesson/level mới chưa lưu) rồi về danh sách. */
function cancelCreateAndBack() {
  if (view.name === 'lesson' && view.isNew) {
    unsavedLessonIds.delete(view.id);
    state.lessons = state.lessons.filter((l) => l.id !== view.id);
    lessonEditSnapshot = null;
    setStatus('Đã huỷ lesson đang tạo.', 'ok');
    goHome('lessons');
    return;
  }
  if (view.name === 'lesson' && lessonEditSnapshot) {
    const idx = state.lessons.findIndex((l) => l.id === view.id);
    if (idx >= 0) state.lessons[idx] = clone(lessonEditSnapshot);
    lessonEditSnapshot = null;
    setStatus('Đã huỷ thay đổi.', 'ok');
    goHome('lessons');
    return;
  }
  if (view.name === 'level' && view.isNew) {
    unsavedLevelIds.delete(view.id);
    state.levels = state.levels.filter((l) => l.id !== view.id);
    setStatus('Đã huỷ level đang tạo.', 'ok');
    goHome('levels');
    return;
  }
  // Đang sửa bản có sẵn — chỉ quay lại, không xoá
  goHome(view.name === 'level' ? 'levels' : 'lessons');
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lessons.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Đã tải bản sao lessons.json (backup). File project đã được Editor ghi trực tiếp khi Lưu.', 'ok');
  notify('Đã tải bản sao JSON', 'ok');
  paint();
}

function applyExerciseFromForm(ex, type, lines) {
  const parse = parsers[type];
  if (!parse) return ex;
  const next = { ...ex, type };
  if (type === 'flip') {
    next.cards = parse(lines);
    delete next.items;
    delete next.pairs;
  } else if (type === 'match') {
    next.pairs = parse(lines);
    delete next.items;
    delete next.cards;
  } else {
    next.items = parse(lines);
    delete next.cards;
    delete next.pairs;
  }
  return next;
}

function emptyExercise(type, lessonId) {
  const id = `${lessonId}-${type}-${Date.now().toString(36).slice(-4)}`;
  const label = exerciseTypes[type]?.label ?? type;
  const base = {
    id,
    type,
    title: label,
    prompt: '',
  };
  if (type === 'flip') base.cards = [];
  else if (type === 'match') base.pairs = [];
  else base.items = [];
  return base;
}

function emptyLesson(levelId) {
  const ids = new Set(state.lessons.map((l) => l.id));
  const id = uniqueId(`draft-${Date.now().toString(36)}`, ids);
  return {
    id,
    levelId,
    title: 'New lesson',
    summary: '',
    body: '',
    tip: '',
    exercises: [emptyExercise('flip', id)],
  };
}

function paint() {
  teardownLessonChrome?.();
  if (view.name === 'level') return paintLevelEditor(view.id);
  if (view.name === 'lesson') return paintLessonEditor(view.id);
  paintHome();
}

function paintHome() {
  if (!selectedLevelId || !state.levels.some((l) => l.id === selectedLevelId)) {
    selectedLevelId = state.levels[0]?.id ?? '';
  }

  const levelOptions = state.levels
    .map(
      (l) =>
        `<option value="${escapeHtml(l.id)}" ${l.id === selectedLevelId ? 'selected' : ''}>${escapeHtml(l.name)}</option>`,
    )
    .join('');

  const lessonsTabActive = homeTab === 'lessons';

  main.innerHTML = `
    <div class="editor">
      <div class="editor__wrap">
        <header class="editor__hero">
          <h1>Lesson Editor</h1>
          <p>Thêm / sửa Level và bài tập nhanh. ID URL được tạo tự động từ tiêu đề — không cần nhập tay.</p>
        </header>

        <div class="ed-steps">
          <strong>Cách dùng nhanh</strong>
          <ol>
            <li>Chọn <strong>Level</strong>, bấm <strong>Thêm Lesson</strong> — mở form, rồi <strong>Lưu</strong> để ghi vào <code>data/lessons.json</code>.</li>
            <li>Thêm / sửa / xoá đều lưu thẳng vào file (cần <code>npm run dev</code>). Bản mới nằm đầu danh sách.</li>
            <li><strong>Tải lessons.json</strong> chỉ để sao lưu thêm; không bắt buộc để áp dụng.</li>
          </ol>
        </div>

        <div class="editor__toolbar">
          <button type="button" class="btn btn--primary" data-download>Tải bản sao JSON</button>
          <label class="ed-btn" style="display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer">
            Nạp file JSON
            <input type="file" accept="application/json,.json" data-import hidden />
          </label>
          <button type="button" class="ed-btn" data-reset>Tải lại từ file</button>
          <a class="ed-btn" href="/lessons.html">Xem trang Lessons</a>
        </div>
        <p class="editor__status ${statusMsg.kind ? `is-${statusMsg.kind}` : ''}">${escapeHtml(statusMsg.text)}</p>

        <div class="editor__tabs" role="tablist">
          <button type="button" class="editor__tab ${!lessonsTabActive ? 'is-active' : ''}" data-tab="levels">Levels (${state.levels.length})</button>
          <button type="button" class="editor__tab ${lessonsTabActive ? 'is-active' : ''}" data-tab="lessons">Lessons (${state.lessons.length})</button>
        </div>

        <section data-pane="levels" ${lessonsTabActive ? 'hidden' : ''}>
          <div class="editor__toolbar">
            <button type="button" class="ed-btn ed-btn--primary" data-add-level>+ Thêm Level</button>
          </div>
          <div class="ed-list">
            ${state.levels
              .map((level) => {
                const count = state.lessons.filter((l) => l.levelId === level.id).length;
                return `
                  <div class="ed-row">
                    <div>
                      <h3 class="ed-row__title">${escapeHtml(level.name)}</h3>
                      <p class="ed-row__meta">${count} lessons · ${escapeHtml(level.title)}</p>
                    </div>
                    <div class="ed-row__actions">
                      <button type="button" class="ed-btn" data-edit-level="${escapeHtml(level.id)}">Sửa</button>
                      <button type="button" class="ed-btn ed-btn--danger" data-del-level="${escapeHtml(level.id)}">Xoá</button>
                    </div>
                  </div>`;
              })
              .join('') || '<p class="ed-empty">Chưa có level.</p>'}
          </div>
        </section>

        <section data-pane="lessons" ${lessonsTabActive ? '' : 'hidden'}>
          <div class="editor__toolbar">
            <label class="ed-field" style="margin:0;min-width:10rem">
              <span class="visually-hidden">Level</span>
              <select data-quick-level>${levelOptions}</select>
            </label>
            <button type="button" class="ed-btn ed-btn--primary" data-add-lesson>+ Thêm Lesson</button>
            <button type="button" class="ed-btn" data-add-quick>Lesson mẫu nhanh</button>
          </div>
          <p class="ed-help" style="margin-top:0">Thêm Lesson / Lesson mẫu mở thẳng form thiết kế; bản mới nằm đầu danh sách, thuộc Level đang chọn.</p>
          <div class="ed-list">
            ${state.lessons
              .map((lesson) => {
                const level = state.levels.find((l) => l.id === lesson.levelId);
                const n = lesson.exercises?.length ?? 0;
                const pending = unsavedLessonIds.has(lesson.id);
                const flash = highlightLessonId === lesson.id ? ' ed-row--flash' : '';
                return `
                  <div class="ed-row${flash}" data-lesson-row="${escapeHtml(lesson.id)}">
                    <div>
                      <h3 class="ed-row__title">${escapeHtml(lesson.title || '(Untitled)')}${pending ? ' <span class="ed-badge">Chưa lưu</span>' : ''}</h3>
                      <p class="ed-row__meta">${escapeHtml(level?.name ?? lesson.levelId)} · ${n} activities</p>
                    </div>
                    <div class="ed-row__actions">
                      <button type="button" class="ed-btn" data-edit-lesson="${escapeHtml(lesson.id)}">Sửa</button>
                      <button type="button" class="ed-btn" data-dup-lesson="${escapeHtml(lesson.id)}">Nhân bản</button>
                      <button type="button" class="ed-btn ed-btn--danger" data-del-lesson="${escapeHtml(lesson.id)}">Xoá</button>
                    </div>
                  </div>`;
              })
              .join('') || '<p class="ed-empty">Chưa có lesson.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;

  main.querySelector('[data-download]')?.addEventListener('click', downloadJson);
  main.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await ask('Tải lại data/lessons.json từ đĩa? Thay đổi chưa lưu trên màn hình sẽ mất.', {
      confirmLabel: 'Tải lại',
      cancelLabel: 'Huỷ',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.levels || !data.lessons) throw new Error('Invalid file');
      state = data;
      unsavedLessonIds.clear();
      unsavedLevelIds.clear();
      highlightLessonId = '';
      selectedLevelId = state.levels[0]?.id ?? '';
      setStatus('Đã tải lại data/lessons.json từ đĩa.', 'ok');
      notify('Đã tải lại từ file', 'ok');
      paint();
    } catch {
      notify('Không đọc được file — hãy chạy npm run dev.', 'warn');
    }
  });

  if (highlightLessonId) {
    const row = main.querySelector(`[data-lesson-row="${CSS.escape(highlightLessonId)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const flashId = highlightLessonId;
    highlightLessonId = '';
    window.setTimeout(() => {
      main.querySelector(`[data-lesson-row="${CSS.escape(flashId)}"]`)?.classList.remove('ed-row--flash');
    }, 1600);
  }

  const fileInput = main.querySelector('[data-import]');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.levels || !parsed.lessons) throw new Error('Missing levels/lessons');
      state = parsed;
      unsavedLessonIds.clear();
      unsavedLevelIds.clear();
      highlightLessonId = '';
      selectedLevelId = state.levels[0]?.id ?? '';
      const saved = await persistState({ silent: true });
      if (saved) {
        setStatus(`Đã nạp và ghi ${file.name} vào data/lessons.json.`, 'ok');
        notify(`Đã nạp «${file.name}» vào data/lessons.json`, 'ok');
      }
      paint();
    } catch {
      setStatus('File JSON không hợp lệ.', 'warn');
      notify('File JSON không hợp lệ (cần levels + lessons).', 'warn');
      paint();
    }
  });

  const panes = {
    levels: main.querySelector('[data-pane="levels"]'),
    lessons: main.querySelector('[data-pane="lessons"]'),
  };
  main.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      homeTab = tab.dataset.tab;
      main.querySelectorAll('[data-tab]').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      panes.levels.hidden = homeTab !== 'levels';
      panes.lessons.hidden = homeTab !== 'lessons';
    });
  });

  main.querySelector('[data-quick-level]')?.addEventListener('change', (event) => {
    selectedLevelId = event.currentTarget.value;
  });

  main.querySelector('[data-add-level]')?.addEventListener('click', () => {
    const nextName = `Level ${state.levels.length + 1}`;
    const ids = new Set(state.levels.map((l) => l.id));
    const id = uniqueId(`cap-${state.levels.length + 1}`, ids);
    state.levels.push({
      id,
      name: nextName,
      title: `English — ${nextName}`,
      description: '',
    });
    unsavedLevelIds.add(id);
    view = { name: 'level', id, isNew: true };
    notify(`Đã tạo ${nextName} — điền thông tin rồi Lưu`, 'ok');
    paint();
  });

  main.querySelectorAll('[data-edit-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view = { name: 'level', id: btn.dataset.editLevel, isNew: false };
      paint();
    });
  });

  main.querySelectorAll('[data-del-level]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delLevel;
      const used = state.lessons.some((l) => l.levelId === id);
      if (used) {
        notify('Không xoá được — vẫn còn lesson thuộc level này.', 'warn');
        return;
      }
      const level = state.levels.find((l) => l.id === id);
      const ok = await ask(`Xoá «${level?.name || id}» khỏi data/lessons.json?`, {
        confirmLabel: 'Xoá',
        cancelLabel: 'Huỷ',
        danger: true,
      });
      if (!ok) return;
      state.levels = state.levels.filter((l) => l.id !== id);
      if (selectedLevelId === id) selectedLevelId = state.levels[0]?.id ?? '';
      const saved = await persistState({ silent: true });
      if (!saved) return;
      setStatus('Đã xoá level và ghi vào data/lessons.json.', 'ok');
      notify('Đã xoá level', 'warn');
      paint();
    });
  });

  async function startNewLesson(template) {
    const levelId = main.querySelector('[data-quick-level]')?.value || selectedLevelId || state.levels[0]?.id;
    if (!levelId) {
      notify('Hãy tạo Level trước rồi mới thêm Lesson.', 'warn');
      homeTab = 'levels';
      paint();
      return;
    }
    const levelName = state.levels.find((l) => l.id === levelId)?.name || levelId;
    const isQuick = Boolean(template);

    selectedLevelId = levelId;
    homeTab = 'lessons';
    const lesson = template ? template(levelId) : emptyLesson(levelId);
    state.lessons.unshift(lesson);
    unsavedLessonIds.add(lesson.id);
    highlightLessonId = lesson.id;
    openExerciseIndex = 0;
    lessonEditSnapshot = null;
    view = { name: 'lesson', id: lesson.id, isNew: true };
    setStatus(
      `Đang thiết kế «${lesson.title || 'New lesson'}» · ${levelName}. Huỷ / Quay lại sẽ xoá bản chưa lưu.`,
      'ok',
    );
    notify(isQuick ? `Đã tạo lesson mẫu · ${levelName}` : `Đã tạo lesson mới · ${levelName}`, 'ok');
    paint();
  }

  main.querySelector('[data-add-lesson]')?.addEventListener('click', () => startNewLesson());

  main.querySelector('[data-add-quick]')?.addEventListener('click', () => {
    startNewLesson((levelId) => {
      const ids = new Set(state.lessons.map((l) => l.id));
      const id = uniqueId(`draft-${Date.now().toString(36)}`, ids);
      return {
        id,
        levelId,
        title: 'Quick lesson',
        summary: 'Edit this summary.',
        body: 'Short intro for students.',
        tip: 'Teacher tip here.',
        exercises: [
          {
            id: `${id}-flip`,
            type: 'flip',
            title: 'Flashcards',
            prompt: 'Flip the cards.',
            cards: [
              { front: 'A', back: 'apple' },
              { front: 'B', back: 'ball' },
            ],
          },
          {
            id: `${id}-picture`,
            type: 'picture',
            title: 'Picture chase',
            prompt: 'Choose the correct word.',
            items: [
              { image: '🍎', options: ['apple', 'ball', 'cat'], answer: 'apple' },
              { image: '/images/apple.svg', imageAlt: 'Apple', options: ['apple', 'dog', 'sun'], answer: 'apple' },
            ],
          },
          {
            id: `${id}-write`,
            type: 'write',
            title: 'Write',
            prompt: 'Type the answer.',
            items: [{ prompt: 'Write the word for 1', hint: 'o…', answer: 'one' }],
          },
        ],
      };
    });
  });

  main.querySelectorAll('[data-edit-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editLesson;
      const lesson = state.lessons.find((l) => l.id === id);
      openExerciseIndex = 0;
      lessonEditSnapshot = lesson && !unsavedLessonIds.has(id) ? clone(lesson) : null;
      view = { name: 'lesson', id, isNew: unsavedLessonIds.has(id) };
      paint();
    });
  });

  main.querySelectorAll('[data-dup-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = state.lessons.find((l) => l.id === btn.dataset.dupLesson);
      if (!src) return;
      const ids = new Set(state.lessons.map((l) => l.id));
      const copy = clone(src);
      copy.id = uniqueId(`${slugify(src.title || src.id)}-copy`, ids);
      copy.title = `${src.title} (copy)`;
      copy.exercises = (copy.exercises || []).map((ex, i) => ({
        ...ex,
        id: `${copy.id}-${ex.type}-${i + 1}`,
      }));
      state.lessons.unshift(copy);
      unsavedLessonIds.add(copy.id);
      highlightLessonId = copy.id;
      homeTab = 'lessons';
      openExerciseIndex = 0;
      lessonEditSnapshot = null;
      view = { name: 'lesson', id: copy.id, isNew: true };
      setStatus(`Đã nhân bản: ${copy.title} — đang mở để chỉnh. Huỷ sẽ xoá bản chưa lưu.`, 'ok');
      notify(`Đã nhân bản «${src.title}»`, 'ok');
      paint();
    });
  });

  main.querySelectorAll('[data-del-lesson]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delLesson;
      const lesson = state.lessons.find((l) => l.id === id);
      const ok = await ask(`Xoá «${lesson?.title || id}» khỏi data/lessons.json?`, {
        confirmLabel: 'Xoá',
        cancelLabel: 'Huỷ',
        danger: true,
      });
      if (!ok) return;
      unsavedLessonIds.delete(id);
      state.lessons = state.lessons.filter((l) => l.id !== id);
      const saved = await persistState({ silent: true });
      if (!saved) return;
      setStatus('Đã xoá lesson và ghi vào data/lessons.json.', 'ok');
      notify('Đã xoá lesson', 'warn');
      paint();
    });
  });
}

function paintLevelEditor(id) {
  const level = state.levels.find((l) => l.id === id);
  if (!level) {
    goHome('levels');
    return;
  }

  const isNew = Boolean(view.isNew);

  main.innerHTML = `
    <div class="editor">
      <div class="editor__wrap">
        <div class="editor__toolbar">
          <button type="button" class="ed-btn" data-back>← Quay lại</button>
          ${isNew ? '<button type="button" class="ed-btn ed-btn--danger" data-cancel>Huỷ thêm mới</button>' : ''}
        </div>
        <header class="editor__hero">
          <h1>${isNew ? 'Thêm Level' : 'Sửa Level'}</h1>
          <p>${isNew ? 'Điền thông tin rồi Lưu. Bấm Huỷ hoặc Quay lại sẽ xoá bản đang tạo.' : 'Đổi tên cấp học.'}</p>
        </header>
        <form class="ed-panel ed-grid" data-level-form>
          <div class="ed-field">
            <label for="level-name">Tên ngắn (hiện trên nút)</label>
            <input id="level-name" name="name" value="${escapeHtml(level.name)}" required placeholder="Level 3" />
          </div>
          <div class="ed-field">
            <label for="level-title">Tiêu đề</label>
            <input id="level-title" name="title" value="${escapeHtml(level.title)}" required />
          </div>
          <div class="ed-field">
            <label for="level-desc">Mô tả</label>
            <textarea id="level-desc" name="description" rows="3">${escapeHtml(level.description || '')}</textarea>
          </div>
          <div class="editor__toolbar">
            <button type="submit" class="btn btn--primary">Lưu Level</button>
            <button type="button" class="btn btn--outline" data-cancel>Huỷ</button>
          </div>
        </form>
      </div>
    </div>
  `;

  main.querySelectorAll('[data-back], [data-cancel]').forEach((btn) => {
    btn.addEventListener('click', cancelCreateAndBack);
  });

  main.querySelector('[data-level-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const title = String(fd.get('title') || '').trim();
    const description = String(fd.get('description') || '').trim();
    if (!name || !title) {
      notify('Hãy nhập tên ngắn và tiêu đề cho Level.', 'warn');
      return;
    }

    if (isNew) {
      const oldLevelId = level.id;
      const ids = new Set(state.levels.filter((l) => l.id !== level.id).map((l) => l.id));
      level.id = uniqueId(name, ids);
      unsavedLevelIds.delete(oldLevelId);
      unsavedLevelIds.delete(level.id);
    }

    level.name = name;
    level.title = title;
    level.description = description;
    selectedLevelId = level.id;
    const saved = await persistState({ silent: true });
    if (!saved) return;
    setStatus('Đã lưu level vào data/lessons.json.', 'ok');
    notify(isNew ? `Đã thêm Level «${name}»` : `Đã lưu Level «${name}»`, 'ok');
    goHome('levels');
  });
}

function paintLessonEditor(id) {
  const lesson = state.lessons.find((l) => l.id === id);
  if (!lesson) {
    goHome('lessons');
    return;
  }
  if (!lesson.exercises) lesson.exercises = [];
  clampOpenExercise(lesson);

  const isNew = Boolean(view.isNew);
  const levelName = state.levels.find((l) => l.id === lesson.levelId)?.name ?? lesson.levelId;
  const ex = lesson.exercises[openExerciseIndex] ?? null;
  const exIndex = openExerciseIndex;

  const levelOptions = state.levels
    .map(
      (l) =>
        `<option value="${escapeHtml(l.id)}" ${l.id === lesson.levelId ? 'selected' : ''}>${escapeHtml(l.name)}</option>`,
    )
    .join('');

  const exNav =
    lesson.exercises
      .map((item, index) => {
        const label = exerciseTypes[item.type]?.label || item.type;
        const active = index === openExerciseIndex ? ' is-active' : '';
        return `<button type="button" class="ed-ex-chip ed-ex-chip--${escapeHtml(item.type)}${active}" data-open-ex="${index}" title="${escapeHtml(item.title || label)}">
          <span class="ed-ex-chip__n">${index + 1}</span>
          <span class="ed-ex-chip__label">${escapeHtml(label)}</span>
        </button>`;
      })
      .join('') || '';

  const exLines = ex
    ? ex.type === 'flip'
      ? serializers.flip(ex.cards)
      : ex.type === 'match'
        ? serializers.match(ex.pairs)
        : serializers[ex.type]?.(ex.items) || ''
    : '';

  const exPanel = ex
    ? `
      <article class="ed-ex-panel" data-ex-index="${exIndex}">
        <div class="ed-ex-panel__head">
          <div class="ed-ex-panel__title">
            <p class="ed-type-badge ed-type-badge--${escapeHtml(ex.type)}">${escapeHtml(exerciseTypes[ex.type]?.label || ex.type)}</p>
            <span class="ed-ex-panel__count">Bài ${exIndex + 1} / ${lesson.exercises.length}</span>
          </div>
          <button type="button" class="ed-btn ed-btn--danger" data-del-ex="${exIndex}">Xoá bài này</button>
        </div>
        <input type="hidden" name="ex-type-${exIndex}" value="${escapeHtml(ex.type)}" />
        <div class="ed-ex-panel__grid">
          <div class="ed-field">
            <label>Title</label>
            <input name="ex-title-${exIndex}" value="${escapeHtml(ex.title || '')}" placeholder="Tên hiển thị" />
          </div>
          <div class="ed-field">
            <label>Prompt</label>
            <input name="ex-prompt-${exIndex}" value="${escapeHtml(ex.prompt || '')}" placeholder="Hướng dẫn ngắn cho học viên" />
          </div>
          <div class="ed-field ed-ex-panel__lines">
            <label>Nội dung (mỗi dòng một mục)</label>
            <textarea name="ex-lines-${exIndex}" rows="8">${escapeHtml(exLines)}</textarea>
            <p class="ed-help">${escapeHtml(TYPE_HELP[ex.type] || '')}</p>
          </div>
          <div class="ed-field ed-images" data-image-tools="${exIndex}" ${ex.type === 'picture' ? '' : 'hidden'}>
            <label>Thêm ảnh từ máy</label>
            <div class="ed-images__row">
              <label class="ed-btn ed-btn--primary ed-images__pick">
                Chọn ảnh…
                <input type="file" accept="image/*" multiple hidden data-pick-images="${exIndex}" />
              </label>
            </div>
            <p class="ed-help">Chọn 1 hoặc nhiều ảnh — thêm dòng vào ô trên. Sửa đáp án / lựa chọn sau dấu <code>|</code>.</p>
            <div class="ed-thumbs" data-thumbs="${exIndex}"></div>
          </div>
        </div>
      </article>`
    : `<p class="ed-empty">Chưa có bài tập — chọn loại bên trên để thêm.</p>`;

  main.innerHTML = `
    <div class="editor editor--lesson">
      <div class="editor__wrap editor__wrap--lesson">
        <header class="ed-sticky-bar ed-sticky-bar--top">
          <div class="ed-sticky-bar__left">
            <button type="button" class="ed-btn" data-back>← Quay lại</button>
            <div class="ed-sticky-bar__titles">
              <p class="ed-sticky-bar__eyebrow">${isNew ? 'Thêm lesson' : 'Sửa lesson'} · ${escapeHtml(levelName)}</p>
              <h1 class="ed-sticky-bar__heading" data-live-title>${escapeHtml(lesson.title || 'Untitled')}</h1>
            </div>
          </div>
          <div class="ed-sticky-bar__actions">
            ${isNew ? '<button type="button" class="ed-btn ed-btn--danger" data-cancel>Huỷ</button>' : '<button type="button" class="ed-btn" data-cancel>Huỷ</button>'}
          <button type="button" class="ed-btn" data-download>Tải bản sao</button>
            <button type="submit" class="btn btn--primary" form="ed-lesson-form">Lưu Lesson</button>
          </div>
        </header>

        <form class="ed-lesson" id="ed-lesson-form" data-lesson-form>
          <p class="editor__status ${statusMsg.kind ? `is-${statusMsg.kind}` : ''}">${escapeHtml(statusMsg.text)}</p>

          <section class="ed-panel ed-meta">
            <div class="ed-meta__grid">
              <div class="ed-field">
                <label for="lesson-level">Level</label>
                <select id="lesson-level" name="levelId">${levelOptions}</select>
              </div>
              <div class="ed-field">
                <label for="lesson-title">Title</label>
                <input id="lesson-title" name="title" value="${escapeHtml(lesson.title)}" required placeholder="Animals" />
              </div>
              <div class="ed-field ed-meta__full">
                <label for="lesson-summary">Summary</label>
                <input id="lesson-summary" name="summary" value="${escapeHtml(lesson.summary || '')}" placeholder="Mô tả ngắn trên danh sách" />
              </div>
            </div>
            <details class="ed-meta__more">
              <summary>Body &amp; tip (tuỳ chọn)</summary>
              <div class="ed-meta__more-body">
                <div class="ed-field">
                  <label for="lesson-body">Body</label>
                  <textarea id="lesson-body" name="body" rows="3">${escapeHtml(lesson.body || '')}</textarea>
                </div>
                <div class="ed-field">
                  <label for="lesson-tip">Tip</label>
                  <input id="lesson-tip" name="tip" value="${escapeHtml(lesson.tip || '')}" />
                </div>
                <p class="ed-help">URL tự tạo từ title, ví dụ «Animals» → /lesson.html?id=animals</p>
              </div>
            </details>
          </section>

          <section class="ed-panel ed-ex-workspace">
            <div class="ed-ex-workspace__head">
              <div>
                <h2>Bài tập <span class="ed-ex-workspace__count">${lesson.exercises.length}</span></h2>
                <p class="ed-help" style="margin:0">Chỉ mở một bài mỗi lần — chọn thẻ bên dưới để chuyển, không cần cuộn dài.</p>
              </div>
            </div>

            <div class="ed-add-types" role="group" aria-label="Thêm loại bài tập">
              ${TYPE_LIST.map(
                (t) =>
                  `<button type="button" class="ed-add-type ed-add-type--${escapeHtml(t.id)}" data-add-ex="${escapeHtml(t.id)}">
                    <span class="ed-add-type__plus">+</span> ${escapeHtml(t.label)}
                  </button>`,
              ).join('')}
            </div>

            ${
              lesson.exercises.length
                ? `<div class="ed-ex-nav" role="tablist" aria-label="Danh sách bài tập">${exNav}</div>`
                : ''
            }

            <div class="ed-ex-stage" data-ex-stage>
              ${exPanel}
            </div>
          </section>
        </form>

        <footer class="ed-sticky-bar ed-sticky-bar--bottom">
          <span class="ed-sticky-bar__hint">${lesson.exercises.length} bài tập · bấm Lưu khi xong</span>
          <div class="ed-sticky-bar__actions">
            <button type="button" class="btn btn--outline" data-cancel>Huỷ</button>
            <button type="submit" class="btn btn--primary" form="ed-lesson-form">Lưu Lesson</button>
          </div>
        </footer>
      </div>

      <button type="button" class="ed-to-top" data-to-top aria-label="Lên đầu trang" title="Lên đầu trang" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M12 6.5 5.5 13l1.4 1.4 4.1-4.1V19h2V10.3l4.1 4.1 1.4-1.4L12 6.5z"/>
        </svg>
      </button>
    </div>
  `;

  const form = main.querySelector('[data-lesson-form]');
  const toTopBtn = main.querySelector('[data-to-top]');

  function syncBeforePaint() {
    syncLessonDraftFromForm(form, lesson, openExerciseIndex);
  }

  function updateToTopVisibility() {
    if (!toTopBtn) return;
    const show = window.scrollY > 220;
    toTopBtn.classList.toggle('is-visible', show);
    toTopBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
    toTopBtn.tabIndex = show ? 0 : -1;
  }

  toTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateToTopVisibility, { passive: true });
  updateToTopVisibility();
  teardownLessonChrome = () => {
    window.removeEventListener('scroll', updateToTopVisibility);
    teardownLessonChrome = null;
  };

  main.querySelectorAll('[data-back], [data-cancel]').forEach((btn) => {
    btn.addEventListener('click', cancelCreateAndBack);
  });
  main.querySelector('[data-download]')?.addEventListener('click', () => {
    syncBeforePaint();
    downloadJson();
  });

  const titleInput = main.querySelector('#lesson-title');
  const liveTitle = main.querySelector('[data-live-title]');
  titleInput?.addEventListener('input', () => {
    if (liveTitle) liveTitle.textContent = titleInput.value.trim() || 'Untitled';
  });

  function refreshThumbs(index) {
    const box = main.querySelector(`[data-thumbs="${index}"]`);
    const textarea = main.querySelector(`[name="ex-lines-${index}"]`);
    if (!box || !textarea) return;
    const srcs = textarea.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split('|')[0]?.trim())
      .filter((src) => src && /^(https?:|data:image\/|\/|\.\/)/i.test(src));

    box.innerHTML = srcs
      .slice(0, 12)
      .map((src) => `<figure class="ed-thumb"><img src="${escapeHtml(src)}" alt="" /></figure>`)
      .join('');
  }

  if (ex?.type === 'picture') refreshThumbs(exIndex);

  main.querySelectorAll('[data-pick-images]').forEach((input) => {
    input.addEventListener('change', async () => {
      const index = input.dataset.pickImages;
      const textarea = main.querySelector(`[name="ex-lines-${index}"]`);
      const files = [...(input.files || [])];
      if (!textarea || !files.length) return;

      setStatus('Đang xử lý ảnh…', '');
      try {
        const lines = [];
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          const src = await fileToImageSrc(file);
          const guess = guessAnswerFromFilename(file.name);
          lines.push(`${src} | ${guess} | ${guess}`);
        }
        if (!lines.length) {
          setStatus('Không có file ảnh hợp lệ.', 'warn');
          return;
        }
        appendLinesToTextarea(textarea, lines);
        refreshThumbs(index);
        setStatus(`Đã thêm ${lines.length} ảnh. Hãy sửa đáp án / lựa chọn cho đúng, rồi Lưu Lesson.`, 'ok');
        notify(`Đã thêm ${lines.length} ảnh`, 'ok');
        const statusEl = main.querySelector('.editor__status');
        if (statusEl) {
          statusEl.textContent = statusMsg.text;
          statusEl.className = `editor__status is-${statusMsg.kind || 'ok'}`;
        }
      } catch {
        setStatus('Không đọc được ảnh. Thử file khác (jpg/png/webp/svg).', 'warn');
        notify('Không đọc được ảnh.', 'warn');
      } finally {
        input.value = '';
      }
    });
  });

  main.querySelectorAll('[name^="ex-lines-"]').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      const index = textarea.name.replace('ex-lines-', '');
      if (lesson.exercises[Number(index)]?.type === 'picture') refreshThumbs(index);
    });
  });

  main.querySelectorAll('[data-open-ex]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.openEx);
      if (next === openExerciseIndex) return;
      syncBeforePaint();
      openExerciseIndex = next;
      paint();
      main.querySelector('.ed-ex-stage')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  main.querySelectorAll('[data-add-ex]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.addEx || 'flip';
      const label = exerciseTypes[type]?.label || type;
      syncBeforePaint();
      lesson.exercises.push(emptyExercise(type, lesson.id));
      openExerciseIndex = lesson.exercises.length - 1;
      setStatus(`Đã thêm bài «${label}» — đang mở để chỉnh.`, 'ok');
      notify(`Đã thêm «${label}»`, 'ok');
      paint();
      main.querySelector('.ed-ex-stage')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  main.querySelectorAll('[data-del-ex]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const index = Number(btn.dataset.delEx);
      const label = exerciseTypes[lesson.exercises[index]?.type]?.label || 'bài tập';
      const ok = await ask(`Xoá «${label}» khỏi lesson này?`, {
        confirmLabel: 'Xoá',
        cancelLabel: 'Huỷ',
        danger: true,
      });
      if (!ok) return;
      syncBeforePaint();
      lesson.exercises.splice(index, 1);
      if (openExerciseIndex >= lesson.exercises.length) {
        openExerciseIndex = Math.max(0, lesson.exercises.length - 1);
      }
      setStatus('Đã xoá bài tập.', 'ok');
      notify('Đã xoá bài tập', 'warn');
      paint();
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncLessonDraftFromForm(form, lesson, openExerciseIndex);

    const title = String(lesson.title || '').trim();
    if (!title) {
      notify('Hãy nhập Title trước khi lưu Lesson.', 'warn');
      paint();
      return;
    }

    const oldId = lesson.id;
    const otherIds = new Set(state.lessons.filter((l) => l.id !== oldId).map((l) => l.id));
    if (isNew) {
      lesson.id = uniqueId(title, otherIds);
    }

    lesson.title = title;
    selectedLevelId = lesson.levelId;

    lesson.exercises = (lesson.exercises || []).map((item, index) => ({
      ...item,
      id: `${lesson.id}-${item.type}-${index + 1}`,
    }));

    unsavedLessonIds.delete(oldId);
    unsavedLessonIds.delete(lesson.id);
    highlightLessonId = lesson.id;
    lessonEditSnapshot = null;
    const saved = await persistState({ silent: true });
    if (!saved) return;
    setStatus('Đã lưu lesson vào data/lessons.json.', 'ok');
    notify(isNew ? `Đã thêm «${title}» vào data/lessons.json` : `Đã lưu «${title}»`, 'ok');
    goHome('lessons');
  });
}

if (import.meta.hot) {
  import.meta.hot.accept('../../data/lessons.json', () => {
    /* Keep in-memory editor state; file already updated by persistState. */
  });
}

paint();
