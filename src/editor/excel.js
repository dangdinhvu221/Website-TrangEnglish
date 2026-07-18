/**
 * Excel templates + import for lesson editor exercise content.
 * Each exercise type has a downloadable .xlsx sample and a row→line parser.
 *
 * Templates embed a hidden `_meta` sheet (type id) so import can detect the
 * form even if the wrong “Dạng bài” is selected in the UI.
 */
import * as XLSX from 'xlsx';

const META_SHEET = '_meta';

function cell(row, index) {
  const value = row?.[index];
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Avoid "4.0" noise; keep integers clean for answers like 4
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

function joinParts(parts) {
  return parts.map((p) => String(p ?? '').trim()).join(' | ');
}

function normalizeHeader(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** @type {Record<string, {
 *   sheetName: string,
 *   fileName: string,
 *   headers: string[],
 *   samples: string[][],
 *   toLine: (row: unknown[]) => string | null,
 * }>} */
export const EXCEL_TEMPLATES = {
  flip: {
    sheetName: 'Flashcards',
    fileName: 'mau-flashcards.xlsx',
    headers: ['Mặt trước', 'Mặt sau'],
    samples: [
      ['A a', 'ay'],
      ['B b', 'bee'],
      ['cat', 'con mèo'],
    ],
    toLine(row) {
      const front = cell(row, 0);
      const back = cell(row, 1);
      if (!front || !back) return null;
      return joinParts([front, back]);
    },
  },
  picture: {
    sheetName: 'Picture',
    fileName: 'mau-picture-chase.xlsx',
    headers: [
      'Ảnh (emoji / URL / đường dẫn)',
      'Đáp án',
      'Lựa chọn (cách nhau bởi dấu phẩy)',
      'Mô tả ảnh (tuỳ chọn)',
    ],
    samples: [
      ['🍎', 'apple', 'apple, ball, cat', ''],
      ['/images/cat.jpg', 'cat', 'cat, dog, bird', 'A cat'],
    ],
    toLine(row) {
      const image = cell(row, 0);
      const answer = cell(row, 1);
      const options = cell(row, 2) || answer;
      const alt = cell(row, 3);
      if (!image || !answer) return null;
      return alt ? joinParts([image, answer, options, alt]) : joinParts([image, answer, options]);
    },
  },
  sentence: {
    sheetName: 'Sentence',
    fileName: 'mau-build-sentence.xlsx',
    headers: ['Câu đúng'],
    samples: [
      ['It is blue'],
      ['The ball is red'],
      ['I like apples'],
    ],
    toLine(row) {
      // Support optional "words | answer" in a single cell, or col0 + col1
      const a = cell(row, 0);
      const b = cell(row, 1);
      if (!a) return null;
      if (b) return joinParts([a, b]);
      return a;
    },
  },
  match: {
    sheetName: 'Match',
    fileName: 'mau-match.xlsx',
    headers: ['Trái', 'Phải'],
    samples: [
      ['red', 'like a strawberry'],
      ['blue', 'like the sky'],
      ['green', 'like grass'],
    ],
    toLine(row) {
      const left = cell(row, 0);
      const right = cell(row, 1);
      if (!left || !right) return null;
      return joinParts([left, right]);
    },
  },
  write: {
    sheetName: 'Write',
    fileName: 'mau-write.xlsx',
    headers: ['Câu hỏi', 'Gợi ý', 'Đáp án', 'Đáp án phụ (tuỳ chọn, cách nhau bởi dấu phẩy)'],
    samples: [
      ['Write the word for 3', 'Starts with th…', 'three', ''],
      ['What colour is the sky?', 'b…', 'blue', 'Blue'],
    ],
    toLine(row) {
      const prompt = cell(row, 0);
      const hint = cell(row, 1);
      const answer = cell(row, 2);
      const accept = cell(row, 3);
      if (!prompt || !answer) return null;
      return accept
        ? joinParts([prompt, hint, answer, accept])
        : joinParts([prompt, hint, answer]);
    },
  },
  choice: {
    sheetName: 'Choice',
    fileName: 'mau-multiple-choice.xlsx',
    headers: [
      'Câu hỏi',
      'Đáp án đúng',
      'Lựa chọn (cách nhau bởi dấu phẩy)',
      'Ảnh (tuỳ chọn)',
    ],
    samples: [
      ['What colour is grass?', 'green', 'green, blue, red', ''],
      ['How many legs does a cat have?', '4', '2, 4, 6', ''],
    ],
    toLine(row) {
      const prompt = cell(row, 0);
      const answer = cell(row, 1);
      const options = cell(row, 2) || answer;
      const image = cell(row, 3);
      if (!prompt || !answer) return null;
      return image
        ? joinParts([prompt, answer, options, image])
        : joinParts([prompt, answer, options]);
    },
  },
  truefalse: {
    sheetName: 'TrueFalse',
    fileName: 'mau-true-false.xlsx',
    headers: ['Câu phát biểu', 'Đáp án (true / false)'],
    samples: [
      ['The sky is blue.', 'true'],
      ['Cats can fly.', 'false'],
      ['One plus one is two.', 'true'],
    ],
    toLine(row) {
      const statement = cell(row, 0);
      let answer = cell(row, 1).toLowerCase();
      if (!statement) return null;
      // Excel often coerces true/false → boolean / TRUE / 1 / 0
      if (['1', 'yes', 'y', 'đúng', 'dung', 't'].includes(answer)) answer = 'true';
      if (['0', 'no', 'n', 'sai', 'f'].includes(answer)) answer = 'false';
      if (!answer) answer = 'true';
      return joinParts([statement, answer]);
    },
  },
  blank: {
    sheetName: 'Blank',
    fileName: 'mau-fill-blank.xlsx',
    headers: ['Câu có ___', 'Đáp án', 'Gợi ý (tuỳ chọn)', 'Đáp án phụ (tuỳ chọn)'],
    samples: [
      ['I ___ a student.', 'am', '', ''],
      ['She ___ to school every day.', 'goes', 'g…', 'go'],
    ],
    toLine(row) {
      const prompt = cell(row, 0);
      const answer = cell(row, 1);
      const hint = cell(row, 2);
      const accept = cell(row, 3);
      if (!prompt || !answer) return null;
      if (hint || accept) return joinParts([prompt, answer, hint, accept]);
      return joinParts([prompt, answer]);
    },
  },
  order: {
    sheetName: 'Order',
    fileName: 'mau-put-in-order.xlsx',
    headers: ['Các bước đúng thứ tự (cách nhau bởi /)'],
    samples: [
      ['Wake up / Brush teeth / Go to school'],
      ['Mix / Bake / Eat'],
    ],
    toLine(row) {
      // Prefer col0; also allow one step per column
      let line = cell(row, 0);
      if (!line && row?.length > 1) {
        line = row.map((_, i) => cell(row, i)).filter(Boolean).join(' / ');
      }
      if (!line) return null;
      // Accept / or | as step separators (users sometimes use |)
      const normalized = line.includes('/')
        ? line
        : line.includes('|')
          ? line
              .split('|')
              .map((p) => p.trim())
              .filter(Boolean)
              .join(' / ')
          : line;
      if (!normalized.includes('/')) return null;
      return normalized;
    },
  },
};

/** Built-in types that have an Excel template. */
export function listExcelTemplateTypes() {
  return Object.keys(EXCEL_TEMPLATES);
}

function looksLikeHeader(row, headers) {
  if (!row?.length || !headers?.length) return false;
  const first = normalizeHeader(cell(row, 0));
  const expected = normalizeHeader(headers[0]);
  if (!first || !expected) return false;
  if (first === expected) return true;
  // Prefix / shared start (e.g. shortened header after edit)
  const expectedStart = expected.split(' ')[0];
  if (expectedStart.length >= 3 && (first.startsWith(expectedStart) || expected.startsWith(first))) {
    return true;
  }
  // First two columns match when present
  if (headers[1]) {
    const second = normalizeHeader(cell(row, 1));
    const expected2 = normalizeHeader(headers[1]);
    if (second && expected2 && (second === expected2 || second.startsWith(expected2.split(' ')[0]))) {
      return first.startsWith(expectedStart) || expected.includes(first.split(' ')[0]);
    }
  }
  return false;
}

function scoreHeaderMatch(row, headers) {
  if (!row?.length || !headers?.length) return 0;
  let score = 0;
  const n = Math.min(headers.length, row.length, 4);
  for (let i = 0; i < n; i += 1) {
    const a = normalizeHeader(cell(row, i));
    const b = normalizeHeader(headers[i]);
    if (!a || !b) continue;
    if (a === b) score += 3;
    else if (a.startsWith(b.split(' ')[0]) || b.startsWith(a.split(' ')[0])) score += 2;
    else if (a.includes(b.split(' ')[0]) || b.includes(a.split(' ')[0])) score += 1;
  }
  return score;
}

/**
 * Infer template type from header row / sheet name when `_meta` is missing
 * (older templates, or files re-saved without meta).
 */
function detectTypeFromRows(rows, sheetName) {
  if (!rows?.length) return null;
  const header = rows[0];
  let best = null;
  let bestScore = 0;
  for (const [type, tpl] of Object.entries(EXCEL_TEMPLATES)) {
    const score = scoreHeaderMatch(header, tpl.headers);
    const sheetBonus =
      normalizeHeader(sheetName) === normalizeHeader(tpl.sheetName) ||
      normalizeHeader(sheetName).includes(normalizeHeader(tpl.sheetName))
        ? 2
        : 0;
    const total = score + sheetBonus;
    if (total > bestScore) {
      bestScore = total;
      best = type;
    }
  }
  // Need a confident header match (at least one solid column)
  return bestScore >= 2 ? best : null;
}

function readSheetRows(sheet) {
  // Keep blank rows — they can separate multiple exercises of the same type
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });
}

function rowIsEmpty(row) {
  if (!row?.length) return true;
  return !(row || []).some((c, i) => c === 0 || c === false || cell(row, i) !== '');
}

function readMetaMap(wb) {
  /** @type {Record<string, string>} */
  const map = {};
  if (!wb.Sheets[META_SHEET]) return map;
  const rows = readSheetRows(wb.Sheets[META_SHEET]).filter((r) => !rowIsEmpty(r));
  for (const row of rows) {
    const key = normalizeHeader(cell(row, 0));
    const val = cell(row, 1).trim();
    if (key && val) map[key] = val;
  }
  return map;
}

function readMetaType(wb) {
  const map = readMetaMap(wb);
  if (map.type && EXCEL_TEMPLATES[map.type]) return map.type;
  if (map.base && EXCEL_TEMPLATES[map.base]) return map.base;
  // Fallback: scan cells for a known type id
  if (!wb.Sheets[META_SHEET]) return null;
  for (const row of readSheetRows(wb.Sheets[META_SHEET])) {
    for (let i = 0; i < (row?.length || 0); i += 1) {
      const val = cell(row, i);
      if (EXCEL_TEMPLATES[val]) return val;
    }
  }
  return null;
}

function listDataSheetNames(wb) {
  return wb.SheetNames.filter((n) => n !== META_SHEET);
}

function pickDataSheet(wb) {
  const names = listDataSheetNames(wb);
  if (!names.length) return null;

  let bestName = names[0];
  let bestCount = -1;
  for (const name of names) {
    const rows = readSheetRows(wb.Sheets[name]);
    const nonEmpty = rows.filter((r) => !rowIsEmpty(r)).length;
    if (nonEmpty > bestCount) {
      bestCount = nonEmpty;
      bestName = name;
    }
  }
  return bestName;
}

function rowsToLines(rows, tpl) {
  const usable = rows.filter((r) => !rowIsEmpty(r));
  if (!usable.length) return [];
  let start = 0;
  if (looksLikeHeader(usable[0], tpl.headers)) start = 1;

  const lines = [];
  for (let i = start; i < usable.length; i += 1) {
    const line = tpl.toLine(usable[i]);
    if (line) lines.push(line);
  }
  return lines;
}

function hideMetaSheet(wb) {
  if (wb.Workbook == null) wb.Workbook = {};
  if (wb.Workbook.Sheets == null) wb.Workbook.Sheets = [];
  const metaIdx = wb.SheetNames.indexOf(META_SHEET);
  while (wb.Workbook.Sheets.length < wb.SheetNames.length) {
    wb.Workbook.Sheets.push({});
  }
  if (metaIdx >= 0) {
    wb.Workbook.Sheets[metaIdx] = { ...(wb.Workbook.Sheets[metaIdx] || {}), Hidden: 1 };
  }
}

function sheetWithCols(aoa, colCountHint = 4) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const width = Math.min(48, Math.max(14, ...aoa.flatMap((r) => (r || []).map((c) => String(c ?? '').length)), 12));
  ws['!cols'] = Array.from({ length: colCountHint }, () => ({ wch: width }));
  return ws;
}

/** Build sheet rows for one type, optionally showing 2 same-type exercises. */
function buildTypeSheetAoa(type, { multiDemo = true } = {}) {
  const tpl = EXCEL_TEMPLATES[type];
  const samples = tpl.samples;
  if (!multiDemo || samples.length < 2) {
    return [tpl.headers, ...samples];
  }
  const mid = Math.max(1, Math.ceil(samples.length / 2));
  return [
    tpl.headers,
    ...samples.slice(0, mid),
    ['---', 'Bài 2 — đổi tên tùy ý'],
    ...samples.slice(mid),
  ];
}

/**
 * Marker for a new exercise block.
 * - @@exercise | flip | Title
 * - @@exercise | Title   (type inherited from sheet)
 * - --- | Title
 * - Bai 2 / Bài 2
 * @param {string} [defaultType]
 */
function parseExerciseMarker(row, defaultType = '') {
  if (!row?.length || rowIsEmpty(row)) return null;

  const raw0 = cell(row, 0);
  const titleFromCols = cell(row, 1) || cell(row, 2);

  // --- or === separator (same type)
  if (/^-+$/.test(raw0) || /^═+$/.test(raw0) || raw0 === '—' || raw0 === '–') {
    const type = defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    let title = titleFromCols;
    if (raw0.includes('|')) {
      title = raw0.split('|').map((p) => p.trim())[1] || title;
    }
    // Also: --- in col0 and title already in col1
    return { type, title: title || '', prompt: cell(row, 3) || '' };
  }
  // "--- | Title" in a single cell
  if (/^-+/.test(raw0) && raw0.includes('|')) {
    const type = defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    const parts = raw0.split('|').map((p) => p.trim());
    return { type, title: parts[1] || '', prompt: parts[2] || '' };
  }

  // Bai 2 / Bài 2 / #2
  if (/^(bai|bài)\s*\d+/i.test(raw0) || /^#+\s*\d*$/.test(raw0)) {
    const type = defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    return { type, title: titleFromCols || raw0, prompt: '' };
  }

  // @@ / @@bai (same type) — optional title in col1
  if (/^@@$/.test(raw0) || /^@@\s*(bai|bài|ex)?$/i.test(raw0)) {
    const maybeType = cell(row, 1);
    const type = EXCEL_TEMPLATES[maybeType] ? maybeType : defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    const title = EXCEL_TEMPLATES[maybeType] ? cell(row, 2) : titleFromCols;
    return { type, title: title || '', prompt: '' };
  }

  // Cell form: @@exercise | type | title
  if (/^@@(exercise|bai|bài|ex)\b/i.test(raw0) && raw0.includes('|')) {
    const parts = raw0.split('|').map((p) => p.trim());
    const maybeType = parts[1];
    const type = EXCEL_TEMPLATES[maybeType] ? maybeType : defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    const title = EXCEL_TEMPLATES[maybeType] ? parts[2] || '' : parts[1] || '';
    const prompt = EXCEL_TEMPLATES[maybeType] ? parts[3] || '' : parts[2] || '';
    return { type, title, prompt };
  }

  // Multi-column: @@exercise | flip | Flashcards
  if (/^@@(exercise|bai|bài|ex)$/i.test(raw0)) {
    const maybeType = cell(row, 1);
    const type = EXCEL_TEMPLATES[maybeType] ? maybeType : defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    const title = EXCEL_TEMPLATES[maybeType] ? cell(row, 2) : cell(row, 1);
    const prompt = EXCEL_TEMPLATES[maybeType] ? cell(row, 3) : cell(row, 2);
    return { type, title: title || '', prompt: prompt || '' };
  }

  const compact = normalizeHeader(raw0);
  if (compact.startsWith('@@exercise') || compact.startsWith('@@bai') || compact.startsWith('@@ex')) {
    const parts = raw0.split('|').map((p) => p.trim());
    const maybeType = parts[1] || cell(row, 1);
    const type = EXCEL_TEMPLATES[maybeType] ? maybeType : defaultType;
    if (!type || !EXCEL_TEMPLATES[type]) return null;
    return {
      type,
      title: (EXCEL_TEMPLATES[maybeType] ? parts[2] || cell(row, 2) : parts[1] || cell(row, 1)) || '',
      prompt: (EXCEL_TEMPLATES[maybeType] ? parts[3] || cell(row, 3) : parts[2] || cell(row, 2)) || '',
    };
  }

  return null;
}

function sheetHasBlockSeparators(rows, defaultType) {
  return rows.some((row) => Boolean(parseExerciseMarker(row, defaultType)));
}

/**
 * Parse blocks in one sheet (multiple exercises, same or mixed types).
 * @param {string} [defaultType] type of the sheet when separators omit type
 * @returns {{ type: string, title: string, prompt: string, lines: string[] }[]}
 */
function parseMarkedBlocks(rows, defaultType = '') {
  /** @type {{ type: string, title: string, prompt: string, lines: string[] }[]} */
  const out = [];
  let current = defaultType && EXCEL_TEMPLATES[defaultType]
    ? { type: defaultType, title: '', prompt: '' }
    : null;
  /** @type {unknown[][]} */
  let buf = [];
  let started = false;

  const flush = () => {
    if (!current) return;
    const tpl = EXCEL_TEMPLATES[current.type];
    if (!tpl) return;
    const lines = rowsToLines(buf, tpl);
    if (lines.length) {
      out.push({
        type: current.type,
        title: current.title || '',
        prompt: current.prompt || '',
        lines,
      });
    }
    buf = [];
  };

  for (const row of rows) {
    const marker = parseExerciseMarker(row, defaultType || current?.type || '');
    if (marker) {
      if (started || buf.length) flush();
      current = { type: marker.type, title: marker.title, prompt: marker.prompt };
      started = true;
      buf = [];
      continue;
    }
    if (rowIsEmpty(row)) continue;
    if (!current && defaultType && EXCEL_TEMPLATES[defaultType]) {
      current = { type: defaultType, title: '', prompt: '' };
    }
    if (current) {
      buf.push(row);
      started = true;
    }
  }
  flush();
  return out;
}

/**
 * Parse one data sheet into zero or more exercises.
 * @returns {{ type: string, title: string, prompt: string, lines: string[], sheetName: string }[]}
 */
function parseSheetExercises(sheetName, rows, preferredType, metaType) {
  if (!rows?.length) return [];

  const detectedType = metaType || detectTypeFromRows(
    rows.filter((r) => !rowIsEmpty(r) && !parseExerciseMarker(r, '')),
    sheetName,
  );
  const type = detectedType || preferredType || '';

  // Typed @@exercise markers OR --- / blank separators for same-type multiples
  if (sheetHasBlockSeparators(rows, type) || rows.some((r) => parseExerciseMarker(r, type))) {
    const blocks = parseMarkedBlocks(rows, type);
    if (blocks.length) return blocks.map((ex) => ({ ...ex, sheetName }));
  }

  if (!type || !EXCEL_TEMPLATES[type]) return [];

  let lines = rowsToLines(rows, EXCEL_TEMPLATES[type]);
  if (!lines.length && preferredType && preferredType !== type && EXCEL_TEMPLATES[preferredType]) {
    lines = rowsToLines(rows, EXCEL_TEMPLATES[preferredType]);
    if (lines.length) {
      return [{ type: preferredType, title: '', prompt: '', lines, sheetName }];
    }
  }
  if (!lines.length) return [];

  return [{ type, title: '', prompt: '', lines, sheetName }];
}

/**
 * Download a sample .xlsx for the given base engine (flip/picture/…).
 * Includes a `---` demo so teachers can add multiple exercises of the same type.
 * @param {string} type base engine id
 * @param {{ fileName?: string, sheetName?: string }} [opts]
 */
export function downloadExcelTemplate(type, opts = {}) {
  const tpl = EXCEL_TEMPLATES[type];
  if (!tpl) throw new Error(`Không có mẫu Excel cho loại «${type}»`);

  const wb = XLSX.utils.book_new();
  const sheetName = (opts.sheetName || tpl.sheetName).slice(0, 31) || tpl.sheetName;
  const aoa = buildTypeSheetAoa(type, { multiDemo: true });
  XLSX.utils.book_append_sheet(wb, sheetWithCols(aoa, tpl.headers.length), sheetName);

  const meta = XLSX.utils.aoa_to_sheet([
    ['format', 'single'],
    ['type', type],
    ['sheet', sheetName],
    ['note', 'Split multiple exercises of this type with a --- row (or a blank row)'],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, META_SHEET);
  hideMetaSheet(wb);

  XLSX.writeFile(wb, opts.fileName || tpl.fileName);
}

/**
 * Download a full-lesson workbook: one sheet per exercise type (+ guide sheet).
 * Each type sheet can hold several exercises of that type (separate with ---).
 * @param {{ fileName?: string, types?: string[] }} [opts]
 */
export function downloadLessonExcelTemplate(opts = {}) {
  const types = (opts.types || Object.keys(EXCEL_TEMPLATES)).filter((t) => EXCEL_TEMPLATES[t]);
  if (!types.length) throw new Error('Không có dạng bài để tạo mẫu');

  const wb = XLSX.utils.book_new();

  const guide = XLSX.utils.aoa_to_sheet([
    ['Hướng dẫn — Lesson nhiều bài tập'],
    [''],
    ['Cách dùng nhanh'],
    ['1. Mỗi sheet = một dạng bài (Flashcards, Picture, Choice, …).'],
    ['2. Trong cùng một sheet có thể có NHIỀU bài cùng dạng: chèn một dòng --- giữa các nhóm.'],
    ['   Ví dụ sheet Flashcards: nhóm thẻ 1 → dòng --- → nhóm thẻ 2 → Import ra 2 bài Flashcards.'],
    ['3. Sheet nào không dùng: xóa hết dòng dữ liệu (chỉ còn tiêu đề) hoặc xóa cả sheet.'],
    ['4. Editor → tab Excel → Import → 1 Lesson gồm mọi bài đã điền.'],
    [''],
    ['Cách tách nhiều bài cùng dạng'],
    ['— Dòng --- (hoặc dòng trống, hoặc @@ ) giữa hai nhóm nội dung'],
    ['— Tuỳ chọn đặt tên: --- | Alphabet   hoặc   @@ | Animals'],
    ['— Hoặc @@exercise | flip | Alphabet (ghi rõ type khi trộn dạng trong 1 sheet)'],
  ]);
  guide['!cols'] = [{ wch: 96 }];
  XLSX.utils.book_append_sheet(wb, guide, 'Huong dan');

  for (const type of types) {
    const tpl = EXCEL_TEMPLATES[type];
    const aoa = buildTypeSheetAoa(type, { multiDemo: true });
    XLSX.utils.book_append_sheet(
      wb,
      sheetWithCols(aoa, tpl.headers.length),
      tpl.sheetName.slice(0, 31),
    );
  }

  const meta = XLSX.utils.aoa_to_sheet([
    ['format', 'lesson'],
    ['types', types.join(',')],
    ['note', 'Multi-exercise lesson — each sheet may contain several same-type activities'],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, META_SHEET);
  hideMetaSheet(wb);

  XLSX.writeFile(wb, opts.fileName || 'mau-lesson-nhieu-bai.xlsx');
}

function isGuideSheetName(name) {
  const key = normalizeHeader(name).replace(/\s+/g, '');
  return key === 'huongdan' || key === 'guide' || key === 'readme';
}

/**
 * Import an Excel workbook into one or more exercises.
 * - Multi-sheet lesson templates → every filled sheet becomes an exercise
 * - Sheet with @@exercise markers → each block is an exercise
 * - Single-type templates → one exercise
 *
 * @param {File} file
 * @param {string} [preferredType] fallback when type cannot be detected
 * @returns {Promise<{
 *   exercises: { type: string, title: string, prompt: string, lines: string[], sheetName: string }[],
 *   format: 'lesson' | 'single',
 * }>}
 */
export async function importExcelWorkbook(file, preferredType) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: false });

  if (!wb.SheetNames?.length) throw new Error('File Excel trống');

  const meta = readMetaMap(wb);
  const metaType = readMetaType(wb);
  const formatHint = normalizeHeader(meta.format || '');
  const sheetNames = listDataSheetNames(wb);
  const dataSheets = sheetNames.filter((n) => !isGuideSheetName(n));
  const isSingleFile =
    formatHint === 'single' || (formatHint !== 'lesson' && dataSheets.length === 1);

  /** @type {{ type: string, title: string, prompt: string, lines: string[], sheetName: string }[]} */
  const exercises = [];

  for (const name of dataSheets) {
    const rows = readSheetRows(wb.Sheets[name]);
    if (!rows.length) continue;

    const sheetMetaType = isSingleFile ? metaType : null;
    const preferred = isSingleFile ? preferredType || metaType : preferredType;
    exercises.push(...parseSheetExercises(name, rows, preferred, sheetMetaType));
  }

  if (!exercises.length) {
    throw new Error(
      'Không đọc được bài tập nào — kiểm tra đúng mẫu cột (hàng 1 tiêu đề, từ hàng 2 nội dung), hoặc tải lại mẫu Lesson nhiều bài.',
    );
  }

  return {
    exercises,
    format: exercises.length > 1 || formatHint === 'lesson' ? 'lesson' : 'single',
  };
}

/**
 * Convenience wrapper: first exercise only (single-type callers).
 * @returns {Promise<{ lines: string[], type: string, detected: boolean }>}
 */
export async function importExcelLines(file, preferredType) {
  const { exercises } = await importExcelWorkbook(file, preferredType);
  const first = exercises[0];
  if (!first) {
    throw new Error('Không đọc được dòng hợp lệ — kiểm tra đúng mẫu cột của dạng bài');
  }
  return {
    lines: first.lines,
    type: first.type,
    detected: true,
  };
}
