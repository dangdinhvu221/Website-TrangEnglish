/**
 * Built-in exercise types + registry for teacher-designed custom types.
 * Built-in / base ids:
 *   flip | picture | sentence | match | write
 *   choice | truefalse | blank | order
 */

/** Interaction engines teachers can pick when designing a custom type. */
export const BASE_ENGINES = {
  flip: {
    id: 'flip',
    label: 'Thẻ lật',
    blurb: 'Lật thẻ để nhớ từ / nghĩa',
    editorHint: 'Mỗi dòng: mặt trước | mặt sau',
  },
  picture: {
    id: 'picture',
    label: 'Chọn theo ảnh',
    blurb: 'Xem ảnh/emoji rồi chọn từ đúng',
    editorHint: 'Mỗi dòng: ảnh | đáp án | lựa chọn',
  },
  choice: {
    id: 'choice',
    label: 'Trắc nghiệm',
    blurb: 'Đọc câu hỏi rồi chọn một đáp án',
    editorHint: 'Mỗi dòng: câu hỏi | đáp án | lựa chọn1, lựa chọn2',
  },
  truefalse: {
    id: 'truefalse',
    label: 'Đúng / Sai',
    blurb: 'Đọc câu và chọn True hoặc False',
    editorHint: 'Mỗi dòng: câu phát biểu | true hoặc false',
  },
  sentence: {
    id: 'sentence',
    label: 'Ghép câu',
    blurb: 'Bắt chữ / từ để ghép thành câu',
    editorHint: 'Mỗi dòng một câu hoàn chỉnh',
  },
  order: {
    id: 'order',
    label: 'Sắp xếp thứ tự',
    blurb: 'Xếp các cụm theo đúng thứ tự',
    editorHint: 'Mỗi dòng: bước1 / bước2 / bước3',
  },
  match: {
    id: 'match',
    label: 'Nối cặp',
    blurb: 'Nối hai cột với nhau',
    editorHint: 'Mỗi dòng: trái | phải',
  },
  write: {
    id: 'write',
    label: 'Gõ đáp án',
    blurb: 'Đọc câu hỏi và gõ câu trả lời',
    editorHint: 'Mỗi dòng: câu hỏi | gợi ý | đáp án',
  },
  blank: {
    id: 'blank',
    label: 'Điền chỗ trống',
    blurb: 'Điền từ vào chỗ trống trong câu',
    editorHint: 'Mỗi dòng: câu có ___ | đáp án',
  },
};

export const BUILTIN_ORDER = [
  'flip',
  'picture',
  'choice',
  'truefalse',
  'sentence',
  'order',
  'match',
  'write',
  'blank',
];

/** Built-in types shown on the site (English labels for learners). */
export const exerciseTypes = {
  flip: {
    id: 'flip',
    label: 'Flashcards',
    blurb: 'Flip cards to remember words',
    base: 'flip',
    color: '#9a7b0a',
  },
  picture: {
    id: 'picture',
    label: 'Picture chase',
    blurb: 'Look at the picture, pick the word',
    base: 'picture',
    color: '#c45c3e',
  },
  choice: {
    id: 'choice',
    label: 'Multiple choice',
    blurb: 'Read and pick the right answer',
    base: 'choice',
    color: '#3d6a7a',
  },
  truefalse: {
    id: 'truefalse',
    label: 'True or false',
    blurb: 'Decide if the sentence is true',
    base: 'truefalse',
    color: '#8a5a2b',
  },
  sentence: {
    id: 'sentence',
    label: 'Build a sentence',
    blurb: 'Catch words and make a full sentence',
    base: 'sentence',
    color: '#2f6b5c',
  },
  order: {
    id: 'order',
    label: 'Put in order',
    blurb: 'Arrange the steps in the right order',
    base: 'order',
    color: '#5a6a3a',
  },
  match: {
    id: 'match',
    label: 'Match',
    blurb: 'Match the pairs',
    base: 'match',
    color: '#2a6f8f',
  },
  write: {
    id: 'write',
    label: 'Write',
    blurb: 'Type the answer in English',
    base: 'write',
    color: '#6b4f2a',
  },
  blank: {
    id: 'blank',
    label: 'Fill the blank',
    blurb: 'Type the missing word in the sentence',
    base: 'blank',
    color: '#6a4a5a',
  },
};

/** @type {Record<string, { id: string, label: string, blurb: string, base: string, color: string, custom: true }>} */
let customTypeMap = {};

export function setCustomTypes(list = []) {
  customTypeMap = {};
  for (const raw of list) {
    if (!raw?.id || !raw?.label) continue;
    const base = BASE_ENGINES[raw.base] ? raw.base : 'write';
    customTypeMap[raw.id] = {
      id: raw.id,
      label: String(raw.label).trim(),
      blurb: String(raw.blurb || '').trim(),
      base,
      color: String(raw.color || '#5a6a7a').trim() || '#5a6a7a',
      custom: true,
    };
  }
}

export function getCustomTypes() {
  return Object.values(customTypeMap);
}

export function getExerciseType(typeId) {
  if (exerciseTypes[typeId]) return exerciseTypes[typeId];
  if (customTypeMap[typeId]) return customTypeMap[typeId];
  return {
    id: typeId,
    label: typeId,
    blurb: '',
    base: typeId,
    color: '#5a6a7a',
  };
}

/** Built-in + custom types (for editor add buttons / filters). */
export function getAllExerciseTypes() {
  return [...BUILTIN_ORDER.map((id) => exerciseTypes[id]), ...getCustomTypes()];
}

/** Resolve which interaction engine runs for a type or exercise. */
export function resolveBaseType(typeOrExercise) {
  if (!typeOrExercise) return null;
  if (typeof typeOrExercise === 'string') {
    const meta = getExerciseType(typeOrExercise);
    if (BASE_ENGINES[meta.base]) return meta.base;
    if (BASE_ENGINES[typeOrExercise]) return typeOrExercise;
    return null;
  }
  const ex = typeOrExercise;
  if (ex.base && BASE_ENGINES[ex.base]) return ex.base;
  if (BASE_ENGINES[ex.type]) return ex.type;
  const meta = getExerciseType(ex.type);
  if (BASE_ENGINES[meta.base]) return meta.base;
  return null;
}

export const CUSTOM_COLOR_PRESETS = [
  '#5a6a7a',
  '#3d6a7a',
  '#c45c3e',
  '#2f6b5c',
  '#2a6f8f',
  '#9a7b0a',
  '#8a5a2b',
  '#5a6a3a',
  '#6a4a5a',
  '#6b4f2a',
];
