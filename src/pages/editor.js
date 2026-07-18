import catalog from '@data/lessons.json';
import {
  BASE_ENGINES,
  BUILTIN_ORDER,
  CUSTOM_COLOR_PRESETS,
  exerciseTypes,
  getAllExerciseTypes,
  getExerciseType,
  resolveBaseType,
  setCustomTypes,
} from '@data/exercise-types.js';
import { site } from '@data/site.js';
import { mountChrome } from '@/components/chrome.js';
import {
  downloadExcelTemplate,
  downloadLessonExcelTemplate,
  importExcelWorkbook,
  listExcelTemplateTypes,
} from '@/editor/excel.js';
import {
  createExerciseForType,
  createSampleLesson,
  getSampleTypeOptions,
  SAMPLE_TYPE_HELP,
} from '@/editor/sample-lesson.js';
import { escapeHtml, setTitle, withBase } from '@/utils.js';

mountChrome();
setTitle('Lesson Editor', site);

const STORAGE_KEY = 'trang-english-lessons-draft';
const API_URL = '/api/lessons';

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeState(data) {
  const next = clone(data);
  if (!Array.isArray(next.customTypes)) next.customTypes = [];
  if (!Array.isArray(next.levels)) next.levels = [];
  if (!Array.isArray(next.lessons)) next.lessons = [];
  setCustomTypes(next.customTypes);
  return next;
}

function loadState() {
  // Prefer file catalog; clear old browser draft so it cannot override disk.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return normalizeState(catalog);
}

function syncCustomRegistry() {
  setCustomTypes(state.customTypes || []);
}

function typeList() {
  return getAllExerciseTypes();
}

function typeMeta(typeId) {
  return getExerciseType(typeId);
}

function baseOf(typeIdOrExercise) {
  return resolveBaseType(typeIdOrExercise);
}

/** Ghi thẳng vào data/lessons.json qua API Vite (npm run dev / preview). */
async function persistState({ silent = false } = {}) {
  const payload = {
    levels: state.levels.filter((l) => !unsavedLevelIds.has(l.id)),
    lessons: state.lessons.filter((l) => !unsavedLessonIds.has(l.id)),
    customTypes: state.customTypes || [],
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
        // Complete sentence only → that line is the correct answer; words auto-split
        if (!line.includes('|')) {
          const words = line.split(/\s+/).map((w) => w.trim()).filter(Boolean);
          return { words, answer: line };
        }
        const [left, ...rest] = line.split('|');
        const answer = rest.join('|').trim();
        const words = left
          .split(/\s+/)
          .map((w) => w.trim())
          .filter(Boolean);
        // "| It is blue" or empty left → derive words from answer
        if (!words.length && answer) {
          return {
            words: answer.split(/\s+/).map((w) => w.trim()).filter(Boolean),
            answer,
          };
        }
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
  choice(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const prompt = parts[0] || '';
        const answer = parts[1] || '';
        const options = (parts[2] || answer)
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        const item = { prompt, answer, options };
        if (parts[3]) item.image = parts[3];
        if (parts[4]) item.imageAlt = parts[4];
        return item;
      })
      .filter((i) => i.prompt && i.answer && i.options.length);
  },
  truefalse(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, ...rest] = line.split('|');
        const statement = left.trim();
        const flag = String(rest.join('|') || '')
          .trim()
          .toLowerCase();
        const truthy = ['true', 't', 'yes', 'y', 'đúng', 'dung', '1'].includes(flag);
        const falsy = ['false', 'f', 'no', 'n', 'sai', '0'].includes(flag);
        if (!statement || (!truthy && !falsy)) return null;
        return { statement, answer: truthy };
      })
      .filter(Boolean);
  },
  blank(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const item = {
          prompt: parts[0] || '',
          answer: parts[1] || '',
        };
        if (parts[2]) item.hint = parts[2];
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
  order(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Optional: shuffled | correct — otherwise whole line is correct order
        let answerLine = line;
        if (line.includes('|')) {
          const [, ...rest] = line.split('|');
          answerLine = rest.join('|').trim() || line.split('|')[0].trim();
        }
        const parts = answerLine
          .split(/\s*\/\s*/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length < 2) return null;
        return { parts, answer: parts.join(' / ') };
      })
      .filter(Boolean);
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
    return items
      .map((i) => {
        const answer = (i.answer || '').trim();
        const words = i.words || [];
        const fromAnswer = answer.split(/\s+/).filter(Boolean);
        const sameSet =
          words.length === fromAnswer.length &&
          [...words].map((w) => w.toLowerCase()).sort().join('\0') ===
            [...fromAnswer].map((w) => w.toLowerCase()).sort().join('\0');
        // Prefer plain sentences when words match the answer (usual case)
        if (sameSet || !words.length) return answer;
        return `${words.join(' ')} | ${answer}`;
      })
      .join('\n');
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
  choice(items = []) {
    return items
      .map((i) => {
        const opts = (i.options || []).join(', ');
        const img = i.image ? ` | ${i.image}` : '';
        const alt = i.image && i.imageAlt ? ` | ${i.imageAlt}` : '';
        return `${i.prompt} | ${i.answer} | ${opts}${img}${alt}`;
      })
      .join('\n');
  },
  truefalse(items = []) {
    return items
      .map((i) => `${i.statement || i.prompt || ''} | ${i.answer ? 'true' : 'false'}`)
      .join('\n');
  },
  blank(items = []) {
    return items
      .map((i) => {
        const hint = i.hint ? ` | ${i.hint}` : ' |';
        const accept = i.accept?.length ? ` | ${i.accept.join(', ')}` : '';
        // prompt | answer | hint | accept
        if (i.hint || i.accept?.length) {
          return `${i.prompt} | ${i.answer}${hint}${accept}`;
        }
        return `${i.prompt} | ${i.answer}`;
      })
      .join('\n');
  },
  order(items = []) {
    return items.map((i) => (i.parts || []).join(' / ') || i.answer || '').join('\n');
  },
};

const TYPE_HELP = {
  flip: 'Nên dùng Excel: Tải mẫu → điền → Import.\nHoặc mỗi dòng: mặt trước | mặt sau\nVí dụ: A a | ay',
  picture:
    'Nên dùng Excel / Chọn ảnh từ máy.\nHoặc mỗi dòng: ảnh | đáp án | lựa chọn1, lựa chọn2 | mô tả ảnh (tuỳ chọn)\nẢnh: emoji, /images/file.png, https://…',
  choice:
    'Mỗi dòng: câu hỏi | đáp án đúng | lựa chọn1, lựa chọn2, … | ảnh (tuỳ chọn)\nVí dụ: What colour is grass? | green | green, blue, red',
  truefalse:
    'Mỗi dòng: câu phát biểu | true hoặc false\nVí dụ: The sky is blue. | true\nCats can fly. | false',
  sentence:
    'Nên dùng Excel: mỗi dòng một câu hoàn chỉnh.\nHoặc dán trực tiếp:\nIt is blue\nThe ball is red',
  order:
    'Mỗi dòng các bước đúng thứ tự, cách nhau bởi /\nVí dụ: Wake up / Brush teeth / Go to school',
  match: 'Nên dùng Excel: Tải mẫu → điền → Import.\nHoặc mỗi dòng: trái | phải\nVí dụ: red | like a strawberry',
  blank:
    'Mỗi dòng: câu có ___ | đáp án | gợi ý (tuỳ chọn) | đáp án phụ\nVí dụ: I ___ a student. | am',
  write:
    'Nên dùng Excel: Tải mẫu → điền → Import.\nHoặc mỗi dòng: câu hỏi | gợi ý | đáp án | đáp án phụ (tuỳ chọn)\nVí dụ: Write the word for 3 | Starts with th… | three',
};

let state = loadState();
let view = { name: 'home' }; // home | level | lesson | customType  (+ isNew?)
let homeTab = 'lessons'; // levels | lessons | types | excel
let selectedLevelId = state.levels[0]?.id ?? '';
let editingCustomTypeId = '';
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
  if (view.name === 'customType' && view.isNew) {
    state.customTypes = (state.customTypes || []).filter((t) => t.id !== view.id);
    syncCustomRegistry();
    setStatus('Đã huỷ dạng bài đang tạo.', 'ok');
    goHome('types');
    return;
  }
  if (view.name === 'customType') {
    goHome('types');
    return;
  }
  // Đang sửa bản có sẵn — chỉ quay lại, không xoá
  goHome(view.name === 'level' ? 'levels' : 'lessons');
}

function applyExerciseFromForm(ex, type, lines) {
  const base = baseOf(type) || baseOf(ex);
  const parse = parsers[base];
  if (!parse || !base) return { ...ex, type };
  const next = { ...ex, type, base };
  if (base === 'flip') {
    next.cards = parse(lines);
    delete next.items;
    delete next.pairs;
  } else if (base === 'match') {
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

/** Create exercise with optional sample content (default: with sample). */
function buildExercise(type, lessonId, index = 1, withSample = true) {
  const meta = typeMeta(type);
  const base = baseOf(type) || 'write';
  return createExerciseForType(type, lessonId, index, {
    withSample,
    title: meta.label || type,
    base,
  });
}

function serializeExerciseLines(ex) {
  const base = baseOf(ex);
  if (!base) return '';
  if (base === 'flip') return serializers.flip(ex.cards);
  if (base === 'match') return serializers.match(ex.pairs);
  return serializers[base]?.(ex.items) || '';
}

function countUsagesOfCustomType(typeId) {
  return state.lessons.reduce(
    (n, lesson) => n + (lesson.exercises || []).filter((ex) => ex.type === typeId).length,
    0,
  );
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
    exercises: [],
  };
}

function paint() {
  teardownLessonChrome?.();
  if (view.name === 'level') return paintLevelEditor(view.id);
  if (view.name === 'lesson') return paintLessonEditor(view.id);
  if (view.name === 'customType') return paintCustomTypeEditor(view.id);
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
            <li>Tab <strong>Excel</strong>: tải «Lesson nhiều bài» hoặc mẫu từng dạng → Import tạo Lesson.</li>
            <li>Tab <strong>Lessons</strong>: thêm / sửa lesson; hoặc <strong>Lesson mẫu theo dạng…</strong>.</li>
            <li>Tab <strong>Dạng bài</strong>: thiết kế dạng riêng (tên + kiểu tương tác).</li>
          </ol>
        </div>

        <div class="editor__toolbar">
          <button type="button" class="ed-btn" data-reset>Tải lại từ file</button>
          <a class="ed-btn" href="${escapeHtml(withBase('/lessons.html'))}">Xem trang Lessons</a>
        </div>
        <p class="editor__status ${statusMsg.kind ? `is-${statusMsg.kind}` : ''}">${escapeHtml(statusMsg.text)}</p>

        <div class="editor__tabs" role="tablist">
          <button type="button" class="editor__tab ${homeTab === 'levels' ? 'is-active' : ''}" data-tab="levels">Levels (${state.levels.length})</button>
          <button type="button" class="editor__tab ${homeTab === 'lessons' ? 'is-active' : ''}" data-tab="lessons">Lessons (${state.lessons.length})</button>
          <button type="button" class="editor__tab ${homeTab === 'types' ? 'is-active' : ''}" data-tab="types">Dạng bài (${(state.customTypes || []).length})</button>
          <button type="button" class="editor__tab ${homeTab === 'excel' ? 'is-active' : ''}" data-tab="excel">Excel</button>
        </div>

        <section data-pane="levels" ${homeTab === 'levels' ? '' : 'hidden'}>
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

        <section data-pane="lessons" ${homeTab === 'lessons' ? '' : 'hidden'}>
          <div class="editor__toolbar">
            <label class="ed-field" style="margin:0;min-width:10rem">
              <span class="visually-hidden">Level</span>
              <select data-quick-level>${levelOptions}</select>
            </label>
            <button type="button" class="ed-btn ed-btn--primary" data-add-lesson>+ Thêm Lesson</button>
            <button type="button" class="ed-btn" data-add-quick>Lesson mẫu theo dạng…</button>
          </div>
          <p class="ed-help" style="margin-top:0">
            <strong>Lesson mẫu theo dạng</strong>: chọn một hoặc nhiều dạng bài → tạo lesson với nội dung mẫu sẵn cho từng dạng.
          </p>
          <div class="ed-sample-picker" data-sample-picker hidden>
            <div class="ed-sample-picker__card">
              <header class="ed-sample-picker__head">
                <h3>Chọn dạng bài mẫu</h3>
                <p>Chọn 1 hoặc nhiều dạng — mỗi dạng có sẵn nội dung ví dụ để chơi thử / xem cấu trúc.</p>
              </header>
              <div class="ed-sample-picker__actions-top">
                <button type="button" class="ed-btn" data-sample-all>Chọn tất cả</button>
                <button type="button" class="ed-btn" data-sample-none>Bỏ chọn</button>
              </div>
              <div class="ed-sample-picker__grid" data-sample-grid></div>
              <footer class="ed-sample-picker__foot">
                <button type="button" class="ed-btn" data-sample-cancel>Huỷ</button>
                <button type="button" class="btn btn--primary" data-sample-create>Tạo lesson mẫu</button>
              </footer>
            </div>
          </div>
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

        <section data-pane="types" ${homeTab === 'types' ? '' : 'hidden'}>
          <div class="editor__toolbar">
            <button type="button" class="ed-btn ed-btn--primary" data-add-custom-type>+ Thiết kế dạng bài mới</button>
          </div>
          <p class="ed-help" style="margin-top:0">
            Chọn một <strong>kiểu tương tác</strong> (thẻ lật, chọn đáp án, ghép câu, nối cặp, gõ đáp án), đặt tên riêng — dạng bài sẽ hiện khi thêm bài trong Lesson.
          </p>
          <div class="ed-panel" style="margin-bottom:1rem">
            <h3 style="margin:0 0 0.5rem">Dạng có sẵn</h3>
            <div class="ed-builtin-types">
              ${BUILTIN_ORDER.map((id) => {
                const t = exerciseTypes[id];
                const eng = BASE_ENGINES[id];
                return `<div class="ed-builtin-type" style="--type-accent:${escapeHtml(t.color)}">
                  <strong>${escapeHtml(t.label)}</strong>
                  <span>${escapeHtml(eng.blurb)}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
          <h3 class="ed-section-title">Dạng tự thiết kế (${(state.customTypes || []).length})</h3>
          <div class="ed-list">
            ${(state.customTypes || [])
              .map((ct) => {
                const eng = BASE_ENGINES[ct.base] || BASE_ENGINES.write;
                const uses = countUsagesOfCustomType(ct.id);
                return `
                  <div class="ed-row">
                    <div>
                      <h3 class="ed-row__title">
                        <span class="ed-type-swatch" style="--type-accent:${escapeHtml(ct.color || '#5a6a7a')}"></span>
                        ${escapeHtml(ct.label)}
                      </h3>
                      <p class="ed-row__meta">${escapeHtml(eng.label)} · ${uses} bài đang dùng${ct.blurb ? ` · ${escapeHtml(ct.blurb)}` : ''}</p>
                    </div>
                    <div class="ed-row__actions">
                      <button type="button" class="ed-btn" data-edit-custom-type="${escapeHtml(ct.id)}">Sửa</button>
                      <button type="button" class="ed-btn ed-btn--danger" data-del-custom-type="${escapeHtml(ct.id)}">Xoá</button>
                    </div>
                  </div>`;
              })
              .join('') || '<p class="ed-empty">Chưa có dạng tự thiết kế — bấm «Thiết kế dạng bài mới».</p>'}
          </div>
        </section>

        <section data-pane="excel" ${homeTab === 'excel' ? '' : 'hidden'}>
          <header class="ed-excel-tools__intro">
            <h2>Excel — tải mẫu &amp; import</h2>
            <p>
              Tải template, điền trên máy, rồi import để tạo Lesson (thuộc Level đang chọn).
              Có thể import <strong>một file chứa nhiều bài tập</strong> → một Lesson đủ activities.
            </p>
          </header>

          <div class="ed-panel ed-excel-tools ed-excel-tools--featured">
            <h3>1. Mẫu Lesson nhiều bài (khuyên dùng)</h3>
            <p class="ed-help" style="margin-top:0">
              Một file Excel: mỗi sheet = một dạng bài. Trong cùng sheet có thể có
              <strong>nhiều bài cùng dạng</strong> — chèn dòng <code>---</code> giữa các nhóm.
              Sheet không dùng: xóa dữ liệu rồi Import một lần.
            </p>
            <button type="button" class="ed-btn ed-btn--primary" data-excel-dl-lesson>
              Tải mẫu Lesson nhiều bài (.xlsx)
            </button>
          </div>

          <div class="ed-panel ed-excel-tools">
            <h3>2. Mẫu từng dạng (một hoặc nhiều bài cùng type)</h3>
            <p class="ed-help" style="margin-top:0">
              File mẫu đã có sẵn dòng <code>---</code> tách 2 bài. Thêm nhóm mới bằng cách chèn
              <code>---</code> (tuỳ chọn tên: <code>--- | Alphabet</code>).
            </p>
            <div class="ed-excel-templates">
              ${listExcelTemplateTypes()
                .map((id) => {
                  const t = exerciseTypes[id] || { label: id, color: '#5a6a7a' };
                  const hint = SAMPLE_TYPE_HELP[id] || BASE_ENGINES[id]?.editorHint || '';
                  return `
                    <div class="ed-excel-template" style="--type-accent:${escapeHtml(t.color || '#5a6a7a')}">
                      <div>
                        <strong>${escapeHtml(t.label)}</strong>
                        <span>${escapeHtml(hint)}</span>
                      </div>
                      <button type="button" class="ed-btn ed-btn--primary" data-excel-dl="${escapeHtml(id)}" data-excel-dl-label="${escapeHtml(t.label)}">Tải mẫu</button>
                    </div>`;
                })
                .join('')}
            </div>
          </div>

          <div class="ed-panel ed-excel-tools">
            <h3>3. Import Excel → tạo Lesson</h3>
            <p class="ed-help" style="margin-top:0">
              File nhiều sheet / nhiều khối tách bởi <code>---</code> → nhiều bài trong một Lesson
              (kể cả cùng một dạng). Hệ thống tự nhận dạng cột.
            </p>
            <div class="ed-excel-import-form">
              <label class="ed-field">
                <span>Level</span>
                <select data-excel-level>${levelOptions}</select>
              </label>
              <label class="ed-field">
                <span>Dạng bài (fallback, file 1 dạng cũ)</span>
                <select data-excel-type>
                  <option value="">Tự nhận dạng</option>
                  ${listExcelTemplateTypes()
                    .map((id) => {
                      const t = exerciseTypes[id];
                      return `<option value="${escapeHtml(id)}">${escapeHtml(t?.label || id)}</option>`;
                    })
                    .join('')}
                </select>
              </label>
              <label class="ed-field">
                <span>Tên Lesson (tuỳ chọn)</span>
                <input type="text" data-excel-title placeholder="Để trống sẽ tự đặt tên" />
              </label>
              <label class="ed-btn ed-btn--primary ed-excel-import-pick">
                Chọn file Excel…
                <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden data-excel-file />
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

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
      state = normalizeState(data);
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

  const panes = {
    levels: main.querySelector('[data-pane="levels"]'),
    lessons: main.querySelector('[data-pane="lessons"]'),
    types: main.querySelector('[data-pane="types"]'),
    excel: main.querySelector('[data-pane="excel"]'),
  };
  main.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      homeTab = tab.dataset.tab;
      main.querySelectorAll('[data-tab]').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      panes.levels.hidden = homeTab !== 'levels';
      panes.lessons.hidden = homeTab !== 'lessons';
      if (panes.types) panes.types.hidden = homeTab !== 'types';
      if (panes.excel) panes.excel.hidden = homeTab !== 'excel';
    });
  });

  main.querySelector('[data-excel-dl-lesson]')?.addEventListener('click', () => {
    try {
      downloadLessonExcelTemplate({
        fileName: 'mau-lesson-nhieu-bai.xlsx',
        types: listExcelTemplateTypes(),
      });
      setStatus('Đã tải mẫu Lesson nhiều bài. Điền các sheet rồi Import ở mục 3.', 'ok');
      notify('Đã tải mẫu Lesson nhiều bài', 'ok');
      const statusEl = main.querySelector('.editor__status');
      if (statusEl) {
        statusEl.textContent = statusMsg.text;
        statusEl.className = `editor__status is-${statusMsg.kind || 'ok'}`;
      }
    } catch (error) {
      notify(error?.message || 'Không tải được mẫu Lesson', 'warn');
    }
  });

  main.querySelectorAll('[data-excel-dl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.excelDl;
      const label = btn.dataset.excelDlLabel || typeMeta(type).label || type;
      try {
        downloadExcelTemplate(type, {
          fileName: `mau-${slugify(label) || type}.xlsx`,
          sheetName: label.slice(0, 31),
        });
        setStatus(`Đã tải template «${label}». Điền xong rồi Import ở mục 3.`, 'ok');
        notify(`Đã tải mẫu «${label}»`, 'ok');
        const statusEl = main.querySelector('.editor__status');
        if (statusEl) {
          statusEl.textContent = statusMsg.text;
          statusEl.className = `editor__status is-${statusMsg.kind || 'ok'}`;
        }
      } catch (error) {
        notify(error?.message || 'Không tải được mẫu Excel', 'warn');
      }
    });
  });

  main.querySelector('[data-excel-file]')?.addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const type = main.querySelector('[data-excel-type]')?.value || '';
    const levelId =
      main.querySelector('[data-excel-level]')?.value || selectedLevelId || state.levels[0]?.id;
    const customTitle = String(main.querySelector('[data-excel-title]')?.value || '').trim();
    if (!file) return;
    if (!levelId) {
      notify('Hãy tạo Level trước.', 'warn');
      input.value = '';
      return;
    }

    setStatus('Đang import Excel…', '');
    try {
      const { exercises: imported, format } = await importExcelWorkbook(file, type || undefined);
      const ids = new Set(state.lessons.map((l) => l.id));
      const lessonId = uniqueId(
        format === 'lesson' || imported.length > 1 ? 'import-lesson' : `import-${imported[0].type}`,
        ids,
      );

      const typeCounts = {};
      const exercises = imported.map((item, index) => {
        const exType = item.type;
        typeCounts[exType] = (typeCounts[exType] || 0) + 1;
        const sameTypeTotal = imported.filter((i) => i.type === exType).length;
        const baseLabel = typeMeta(exType).label || exType;
        const label =
          item.title ||
          (sameTypeTotal > 1 ? `${baseLabel} ${typeCounts[exType]}` : baseLabel);
        let exercise = buildExercise(exType, lessonId, index + 1, false);
        exercise = applyExerciseFromForm(exercise, exType, item.lines.join('\n'));
        exercise.title = label;
        exercise.prompt =
          item.prompt ||
          exercise.prompt ||
          BASE_ENGINES[exType]?.blurb ||
          typeMeta(exType).blurb ||
          '';
        return exercise;
      });

      const typeLabels = [...new Set(exercises.map((ex) => typeMeta(ex.type).label || ex.type))];
      const lesson = {
        id: lessonId,
        levelId,
        title:
          customTitle ||
          (exercises.length > 1
            ? `Import — ${exercises.length} activities`
            : `Import — ${typeLabels[0]}`),
        summary: `Imported from Excel · ${exercises.length} activities · ${file.name}`,
        body: '',
        tip: '',
        exercises,
      };
      state.lessons.unshift(lesson);
      unsavedLessonIds.add(lesson.id);
      highlightLessonId = lesson.id;
      selectedLevelId = levelId;
      homeTab = 'lessons';
      openExerciseIndex = 0;
      lessonEditSnapshot = null;
      view = { name: 'lesson', id: lesson.id, isNew: true };
      setStatus(
        `Đã import ${exercises.length} bài tập → lesson «${lesson.title}». Kiểm tra rồi Lưu Lesson.`,
        'ok',
      );
      notify(`Đã tạo lesson từ Excel (${exercises.length} bài)`, 'ok');
      paint();
    } catch (error) {
      setStatus(error?.message || 'Import Excel thất bại', 'warn');
      notify(error?.message || 'Import Excel thất bại', 'warn');
      paint();
    } finally {
      input.value = '';
    }
  });

  main.querySelector('[data-add-custom-type]')?.addEventListener('click', () => {
    const ids = new Set((state.customTypes || []).map((t) => t.id));
    const id = uniqueId(`custom-${Date.now().toString(36).slice(-5)}`, ids);
    const draft = {
      id,
      label: 'Dạng bài mới',
      blurb: '',
      base: 'write',
      color: CUSTOM_COLOR_PRESETS[Math.floor(Math.random() * CUSTOM_COLOR_PRESETS.length)],
    };
    state.customTypes = [draft, ...(state.customTypes || [])];
    syncCustomRegistry();
    editingCustomTypeId = id;
    view = { name: 'customType', id, isNew: true };
    paint();
  });

  main.querySelectorAll('[data-edit-custom-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingCustomTypeId = btn.dataset.editCustomType;
      view = { name: 'customType', id: editingCustomTypeId, isNew: false };
      paint();
    });
  });

  main.querySelectorAll('[data-del-custom-type]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delCustomType;
      const ct = (state.customTypes || []).find((t) => t.id === id);
      const uses = countUsagesOfCustomType(id);
      const ok = await ask(
        uses
          ? `Xoá dạng «${ct?.label || id}»? ${uses} bài đang dùng vẫn chạy nhờ kiểu tương tác đã lưu.`
          : `Xoá dạng «${ct?.label || id}»?`,
        { confirmLabel: 'Xoá', cancelLabel: 'Huỷ', danger: true },
      );
      if (!ok) return;
      state.customTypes = (state.customTypes || []).filter((t) => t.id !== id);
      syncCustomRegistry();
      const saved = await persistState({ silent: true });
      if (saved) {
        setStatus(`Đã xoá dạng bài «${ct?.label || id}».`, 'ok');
        notify('Đã xoá dạng bài', 'ok');
      }
      paint();
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

  const samplePicker = main.querySelector('[data-sample-picker]');
  const sampleGrid = main.querySelector('[data-sample-grid]');

  function fillSampleGrid() {
    if (!sampleGrid) return;
    sampleGrid.innerHTML = getSampleTypeOptions()
      .map(
        (t) => `
        <label class="ed-sample-type" style="--type-accent:${escapeHtml(t.color)}">
          <input type="checkbox" name="sample-type" value="${escapeHtml(t.id)}" />
          <span class="ed-sample-type__label">${escapeHtml(t.label)}</span>
          <span class="ed-sample-type__blurb">${escapeHtml(t.blurb)}</span>
        </label>`,
      )
      .join('');
  }

  function setSamplePickerOpen(open) {
    if (!samplePicker) return;
    samplePicker.hidden = !open;
    if (open) {
      fillSampleGrid();
      samplePicker.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function selectedSampleTypes() {
    return [...(sampleGrid?.querySelectorAll('input[name="sample-type"]:checked') || [])].map(
      (el) => el.value,
    );
  }

  main.querySelector('[data-add-quick]')?.addEventListener('click', () => {
    const levelId = main.querySelector('[data-quick-level]')?.value || selectedLevelId || state.levels[0]?.id;
    if (!levelId) {
      notify('Hãy tạo Level trước rồi mới thêm Lesson.', 'warn');
      homeTab = 'levels';
      paint();
      return;
    }
    setSamplePickerOpen(Boolean(samplePicker?.hidden));
  });

  main.querySelector('[data-sample-cancel]')?.addEventListener('click', () => setSamplePickerOpen(false));

  main.querySelector('[data-sample-all]')?.addEventListener('click', () => {
    sampleGrid?.querySelectorAll('input[name="sample-type"]').forEach((el) => {
      el.checked = true;
    });
  });

  main.querySelector('[data-sample-none]')?.addEventListener('click', () => {
    sampleGrid?.querySelectorAll('input[name="sample-type"]').forEach((el) => {
      el.checked = false;
    });
  });

  main.querySelector('[data-sample-create]')?.addEventListener('click', () => {
    const types = selectedSampleTypes();
    if (!types.length) {
      notify('Chọn ít nhất một dạng bài mẫu.', 'warn');
      return;
    }
    setSamplePickerOpen(false);
    startNewLesson((levelId) => {
      const ids = new Set(state.lessons.map((l) => l.id));
      const base =
        types.length === 1 ? `sample-${types[0]}` : types.length >= 9 ? 'demo-all-types' : 'sample-mix';
      const id = uniqueId(base, ids);
      return createSampleLesson(levelId, types, id);
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

function paintCustomTypeEditor(id) {
  const isNew = Boolean(view.isNew);
  const ct = (state.customTypes || []).find((t) => t.id === id);
  if (!ct) {
    goHome('types');
    return;
  }

  const engineOptions = Object.values(BASE_ENGINES)
    .map(
      (eng) =>
        `<option value="${escapeHtml(eng.id)}" ${ct.base === eng.id ? 'selected' : ''}>${escapeHtml(eng.label)} — ${escapeHtml(eng.blurb)}</option>`,
    )
    .join('');

  const colorPresets = CUSTOM_COLOR_PRESETS.map(
    (c) =>
      `<button type="button" class="ed-color-swatch ${ct.color === c ? 'is-active' : ''}" data-color="${escapeHtml(c)}" style="--type-accent:${escapeHtml(c)}" title="${escapeHtml(c)}"></button>`,
  ).join('');

  const uses = countUsagesOfCustomType(ct.id);
  const eng = BASE_ENGINES[ct.base] || BASE_ENGINES.write;

  main.innerHTML = `
    <div class="editor">
      <div class="editor__wrap">
        <header class="editor__hero">
          <button type="button" class="ed-btn" data-back>← Quay lại</button>
          <h1>${isNew ? 'Thiết kế dạng bài mới' : 'Sửa dạng bài'}</h1>
          <p>Chọn kiểu tương tác, đặt tên riêng — học viên sẽ thấy tên này khi chọn hoạt động.</p>
        </header>
        <p class="editor__status ${statusMsg.kind ? `is-${statusMsg.kind}` : ''}">${escapeHtml(statusMsg.text)}</p>

        <form class="ed-panel" data-custom-type-form>
          <div class="ed-grid">
            <div class="ed-field">
              <label for="ct-label">Tên dạng bài</label>
              <input id="ct-label" name="label" value="${escapeHtml(ct.label)}" required maxlength="48" placeholder="VD: Điền chỗ trống" />
            </div>
            <div class="ed-field">
              <label for="ct-base">Kiểu tương tác</label>
              <select id="ct-base" name="base" ${uses && !isNew ? '' : ''}>${engineOptions}</select>
              <p class="ed-help">Quy tắc chơi cố định theo kiểu này. ${uses ? `Đang dùng trong ${uses} bài.` : ''}</p>
            </div>
            <div class="ed-field" style="grid-column:1/-1">
              <label for="ct-blurb">Mô tả ngắn (tuỳ chọn)</label>
              <input id="ct-blurb" name="blurb" value="${escapeHtml(ct.blurb || '')}" maxlength="120" placeholder="Hiện trong editor / gợi ý giáo viên" />
            </div>
            <div class="ed-field" style="grid-column:1/-1">
              <label>Màu nhận diện</label>
              <div class="ed-color-row">
                ${colorPresets}
                <label class="ed-color-custom">
                  <span class="visually-hidden">Màu tuỳ chọn</span>
                  <input type="color" name="color" value="${escapeHtml(ct.color || '#5a6a7a')}" />
                </label>
              </div>
            </div>
          </div>

          <div class="ed-custom-preview" style="--type-accent:${escapeHtml(ct.color || '#5a6a7a')}">
            <span class="ed-custom-preview__type" data-live-type>${escapeHtml(ct.label)}</span>
            <span class="ed-custom-preview__engine" data-live-engine>${escapeHtml(eng.label)}</span>
            <p class="ed-help" style="margin:0.5rem 0 0">Nội dung Excel / dòng: ${escapeHtml(eng.editorHint)}</p>
          </div>

          <div class="editor__toolbar" style="margin-top:1.25rem">
            ${isNew ? '<button type="button" class="ed-btn ed-btn--danger" data-cancel>Huỷ</button>' : '<button type="button" class="ed-btn" data-cancel>Huỷ</button>'}
            <button type="submit" class="btn btn--primary">Lưu dạng bài</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = main.querySelector('[data-custom-type-form]');
  const liveType = main.querySelector('[data-live-type]');
  const liveEngine = main.querySelector('[data-live-engine]');
  const preview = main.querySelector('.ed-custom-preview');
  const colorInput = form.querySelector('input[name="color"]');

  function refreshPreview() {
    const label = form.label.value.trim() || 'Dạng bài mới';
    const base = form.base.value;
    const color = form.color.value || '#5a6a7a';
    if (liveType) liveType.textContent = label;
    if (liveEngine) liveEngine.textContent = BASE_ENGINES[base]?.label || base;
    preview?.style.setProperty('--type-accent', color);
  }

  form.label?.addEventListener('input', refreshPreview);
  form.base?.addEventListener('change', refreshPreview);
  colorInput?.addEventListener('input', refreshPreview);

  main.querySelectorAll('[data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (colorInput) colorInput.value = btn.dataset.color;
      main.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('is-active', b === btn));
      refreshPreview();
    });
  });

  main.querySelectorAll('[data-back], [data-cancel]').forEach((btn) => {
    btn.addEventListener('click', cancelCreateAndBack);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = String(form.label.value || '').trim();
    const blurb = String(form.blurb.value || '').trim();
    const base = String(form.base.value || 'write');
    const color = String(form.color.value || '#5a6a7a');
    if (!label) {
      setStatus('Nhập tên dạng bài.', 'warn');
      paint();
      return;
    }
    if (!BASE_ENGINES[base]) {
      setStatus('Chọn kiểu tương tác hợp lệ.', 'warn');
      paint();
      return;
    }
    ct.label = label;
    ct.blurb = blurb;
    ct.base = base;
    ct.color = color;
    syncCustomRegistry();

    // Keep base in sync on existing exercises of this custom type
    for (const lesson of state.lessons) {
      for (const ex of lesson.exercises || []) {
        if (ex.type === ct.id) ex.base = base;
      }
    }

    const saved = await persistState({ silent: true });
    if (saved) {
      setStatus(`Đã lưu dạng bài «${label}».`, 'ok');
      notify(`Đã lưu «${label}»`, 'ok');
      view = { name: 'home' };
      homeTab = 'types';
      paint();
    } else {
      paint();
    }
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
        const meta = typeMeta(item.type);
        const label = meta.label || item.type;
        const active = index === openExerciseIndex ? ' is-active' : '';
        const customStyle = meta.custom
          ? ` style="--type-accent:${escapeHtml(meta.color || '#5a6a7a')}"`
          : '';
        const chipMod = meta.custom ? 'ed-ex-chip--custom' : `ed-ex-chip--${escapeHtml(item.type)}`;
        return `<button type="button" class="ed-ex-chip ${chipMod}${active}" data-open-ex="${index}" title="${escapeHtml(item.title || label)}"${customStyle}>
          <span class="ed-ex-chip__n">${index + 1}</span>
          <span class="ed-ex-chip__label">${escapeHtml(label)}</span>
        </button>`;
      })
      .join('') || '';

  const exBase = ex ? baseOf(ex) : null;
  const exMeta = ex ? typeMeta(ex.type) : null;
  const exLines = ex ? serializeExerciseLines(ex) : '';
  const badgeClass = exMeta?.custom
    ? 'ed-type-badge ed-type-badge--custom'
    : `ed-type-badge ed-type-badge--${escapeHtml(ex?.type || '')}`;
  const badgeStyle = exMeta?.custom
    ? ` style="--type-accent:${escapeHtml(exMeta.color || '#5a6a7a')}"`
    : '';

  const exPanel = ex
    ? `
      <article class="ed-ex-panel" data-ex-index="${exIndex}">
        <div class="ed-ex-panel__head">
          <div class="ed-ex-panel__title">
            <p class="${badgeClass}"${badgeStyle}>${escapeHtml(exMeta?.label || ex.type)}</p>
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
            <p class="ed-help">${escapeHtml(TYPE_HELP[exBase] || BASE_ENGINES[exBase]?.editorHint || '')}</p>
            <p class="ed-help">Tải template / Import Excel: về trang chủ Editor → tab <strong>Excel</strong>.</p>
          </div>
          <div class="ed-field ed-images" data-image-tools="${exIndex}" ${exBase === 'picture' ? '' : 'hidden'}>
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
    : `<p class="ed-empty">Chưa có bài tập — chọn dạng ở khung «Thêm bài tập» phía trên (có thể chọn nhiều), rồi bấm <strong>Thêm bài đã chọn</strong>.</p>`;

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
                <p class="ed-help" style="margin:0">Chọn nhiều dạng → thêm một lúc. Mặc định có sẵn nội dung mẫu — chỉ cần sửa rồi Lưu.</p>
              </div>
            </div>

            <div class="ed-add-panel" data-add-panel>
              <div class="ed-add-panel__head">
                <h3>Thêm bài tập</h3>
                <div class="ed-add-panel__tools">
                  <button type="button" class="ed-btn" data-add-all>Chọn tất cả</button>
                  <button type="button" class="ed-btn" data-add-none>Bỏ chọn</button>
                </div>
              </div>
              <div class="ed-sample-picker__grid" data-add-grid>
                ${typeList()
                  .map((t) => {
                    const base = t.base || t.id;
                    const blurb = SAMPLE_TYPE_HELP[base] || t.blurb || '';
                    const style = ` style="--type-accent:${escapeHtml(t.color || '#5a6a7a')}"`;
                    return `
                      <label class="ed-sample-type"${style}>
                        <input type="checkbox" name="add-ex-type" value="${escapeHtml(t.id)}" />
                        <span class="ed-sample-type__label">${escapeHtml(t.label)}</span>
                        <span class="ed-sample-type__blurb">${escapeHtml(blurb)}</span>
                      </label>`;
                  })
                  .join('')}
              </div>
              <div class="ed-add-panel__foot">
                <label class="ed-add-panel__sample">
                  <input type="checkbox" name="add-with-sample" data-add-sample checked />
                  Điền sẵn nội dung mẫu (khuyên dùng)
                </label>
                <button type="button" class="btn btn--primary" data-add-selected>Thêm bài đã chọn</button>
              </div>
              <p class="ed-help" style="margin:0.65rem 0 0">
                Muốn dạng riêng? Tab <strong>Dạng bài</strong> trên trang chủ Editor. Sau khi thêm, sửa nội dung hoặc Import Excel.
              </p>
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

  if (exBase === 'picture') refreshThumbs(exIndex);

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
      if (baseOf(lesson.exercises[Number(index)]) === 'picture') refreshThumbs(index);
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

  const addGrid = main.querySelector('[data-add-grid]');

  main.querySelector('[data-add-all]')?.addEventListener('click', () => {
    addGrid?.querySelectorAll('input[name="add-ex-type"]').forEach((el) => {
      el.checked = true;
    });
  });

  main.querySelector('[data-add-none]')?.addEventListener('click', () => {
    addGrid?.querySelectorAll('input[name="add-ex-type"]').forEach((el) => {
      el.checked = false;
    });
  });

  main.querySelector('[data-add-selected]')?.addEventListener('click', () => {
    const types = [...(addGrid?.querySelectorAll('input[name="add-ex-type"]:checked') || [])].map(
      (el) => el.value,
    );
    if (!types.length) {
      notify('Chọn ít nhất một dạng bài để thêm.', 'warn');
      return;
    }
    const withSample = Boolean(main.querySelector('[data-add-sample]')?.checked);
    syncBeforePaint();
    const startIndex = lesson.exercises.length;
    types.forEach((type, i) => {
      lesson.exercises.push(buildExercise(type, lesson.id, startIndex + i + 1, withSample));
    });
    openExerciseIndex = startIndex;
    const labels = types.map((t) => typeMeta(t).label || t);
    setStatus(
      withSample
        ? `Đã thêm ${types.length} bài kèm nội dung mẫu — sửa rồi Lưu Lesson.`
        : `Đã thêm ${types.length} bài trống — điền nội dung hoặc Import Excel.`,
      'ok',
    );
    notify(
      types.length === 1 ? `Đã thêm «${labels[0]}»` : `Đã thêm ${types.length} bài tập`,
      'ok',
    );
    paint();
    main.querySelector('.ed-ex-stage')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  main.querySelectorAll('[data-del-ex]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const index = Number(btn.dataset.delEx);
      const label = typeMeta(lesson.exercises[index]?.type).label || 'bài tập';
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
  import.meta.hot.accept('@data/lessons.json', () => {
    /* Keep in-memory editor state; file already updated by persistState. */
  });
}

paint();
