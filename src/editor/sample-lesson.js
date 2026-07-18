/**
 * Ready-made sample exercises per type — used when creating a sample lesson
 * from the Editor type picker.
 */

import { BUILTIN_ORDER, exerciseTypes } from '@data/exercise-types.js';

/** Sample exercise payload by type id (without id — filled when creating). */
export const SAMPLE_EXERCISES = {
  flip: {
    type: 'flip',
    base: 'flip',
    title: 'Flashcards',
    prompt: 'Tap a card to flip — front ↔ back.',
    cards: [
      { front: 'apple', back: 'quả táo' },
      { front: 'blue', back: 'màu xanh dương' },
      { front: 'happy', back: 'vui vẻ' },
    ],
  },
  picture: {
    type: 'picture',
    base: 'picture',
    title: 'Picture chase',
    prompt: 'Look at the picture / emoji, then pick the correct word.',
    items: [
      { image: '🍎', options: ['apple', 'ball', 'cat'], answer: 'apple' },
      {
        image: '/images/apple.svg',
        imageAlt: 'An apple',
        options: ['apple', 'dog', 'sun'],
        answer: 'apple',
      },
      { image: '🔵', options: ['red', 'blue', 'green'], answer: 'blue' },
    ],
  },
  choice: {
    type: 'choice',
    base: 'choice',
    title: 'Multiple choice',
    prompt: 'Read the question and choose one answer.',
    items: [
      {
        prompt: 'What colour is grass?',
        answer: 'green',
        options: ['green', 'blue', 'red'],
      },
      {
        prompt: 'How many legs does a cat have?',
        answer: '4',
        options: ['2', '4', '6'],
      },
      {
        prompt: 'Which word means “con mèo”?',
        answer: 'cat',
        options: ['dog', 'cat', 'bird'],
      },
    ],
  },
  truefalse: {
    type: 'truefalse',
    base: 'truefalse',
    title: 'True or false',
    prompt: 'Read the sentence. Is it True or False?',
    items: [
      { statement: 'The sky is blue.', answer: true },
      { statement: 'Cats can fly.', answer: false },
      { statement: 'One plus one is two.', answer: true },
    ],
  },
  sentence: {
    type: 'sentence',
    base: 'sentence',
    title: 'Build a sentence',
    prompt: 'Catch the floating words and build the full sentence.',
    items: [
      { words: ['It', 'is', 'blue'], answer: 'It is blue' },
      { words: ['I', 'like', 'apples'], answer: 'I like apples' },
      { words: ['The', 'ball', 'is', 'red'], answer: 'The ball is red' },
    ],
  },
  order: {
    type: 'order',
    base: 'order',
    title: 'Put in order',
    prompt: 'Tap the pieces in the correct order.',
    items: [
      {
        parts: ['Wake up', 'Brush teeth', 'Go to school'],
        answer: 'Wake up / Brush teeth / Go to school',
      },
      { parts: ['Mix', 'Bake', 'Eat'], answer: 'Mix / Bake / Eat' },
    ],
  },
  match: {
    type: 'match',
    base: 'match',
    title: 'Match',
    prompt: 'Tap a word on the left, then its meaning on the right.',
    pairs: [
      { left: 'red', right: 'like a strawberry' },
      { left: 'blue', right: 'like the sky' },
      { left: 'green', right: 'like grass' },
    ],
  },
  write: {
    type: 'write',
    base: 'write',
    title: 'Write',
    prompt: 'Type the answer in English.',
    items: [
      {
        prompt: 'Write the word for 3',
        hint: 'Starts with th…',
        answer: 'three',
      },
      {
        prompt: 'What colour is the sky?',
        hint: 'b…',
        answer: 'blue',
        accept: ['Blue'],
      },
    ],
  },
  blank: {
    type: 'blank',
    base: 'blank',
    title: 'Fill the blank',
    prompt: 'Type the missing word for the blank (___).',
    items: [
      { prompt: 'I ___ a student.', answer: 'am' },
      {
        prompt: 'She ___ to school every day.',
        hint: 'g…',
        answer: 'goes',
        accept: ['go'],
      },
      { prompt: 'They ___ happy.', answer: 'are' },
    ],
  },
};

/** Short Vietnamese guide shown in the type picker. */
export const SAMPLE_TYPE_HELP = {
  flip: 'Thẻ lật: mặt trước | mặt sau',
  picture: 'Ảnh/emoji → chọn từ đúng',
  choice: 'Câu hỏi → chọn một đáp án',
  truefalse: 'Câu phát biểu → True / False',
  sentence: 'Bắt chữ ghép thành câu',
  order: 'Xếp các bước theo thứ tự',
  match: 'Nối từ với nghĩa',
  write: 'Gõ câu trả lời',
  blank: 'Điền từ vào chỗ trống ___',
};

export function getSampleTypeOptions() {
  return BUILTIN_ORDER.filter((id) => SAMPLE_EXERCISES[id]).map((id) => {
    const meta = exerciseTypes[id];
    return {
      id,
      label: meta?.label || id,
      blurb: SAMPLE_TYPE_HELP[id] || meta?.blurb || '',
      color: meta?.color || '#5a6a7a',
    };
  });
}

function cloneSample(type) {
  const src = SAMPLE_EXERCISES[type];
  if (!src) return null;
  return JSON.parse(JSON.stringify(src));
}

/** Build one sample exercise for a type. */
export function createSampleExercise(type, lessonId, index = 1) {
  const sample = cloneSample(type);
  if (!sample) return null;
  sample.id = `${lessonId}-${type}-${index}`;
  return sample;
}

/**
 * Create an exercise for a type id (built-in or custom).
 * When withSample is true, fills ready-made example content for the interaction base.
 * @param {string} typeId
 * @param {string} lessonId
 * @param {number} index
 * @param {{ withSample?: boolean, title?: string, base?: string }} [opts]
 */
export function createExerciseForType(typeId, lessonId, index = 1, opts = {}) {
  const withSample = opts.withSample !== false;
  const base = opts.base || (SAMPLE_EXERCISES[typeId] ? typeId : null);
  const sampleBase = base && SAMPLE_EXERCISES[base] ? base : null;

  if (withSample && sampleBase) {
    const ex = createSampleExercise(sampleBase, lessonId, index);
    ex.type = typeId;
    ex.base = sampleBase;
    if (opts.title) ex.title = opts.title;
    else if (typeId !== sampleBase) ex.title = opts.title || ex.title;
    ex.id = `${lessonId}-${String(typeId).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-${index}`;
    return ex;
  }

  const resolvedBase = sampleBase || base || 'write';
  const next = {
    id: `${lessonId}-${String(typeId).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-${index}`,
    type: typeId,
    base: resolvedBase,
    title: opts.title || typeId,
    prompt: '',
  };
  if (resolvedBase === 'flip') next.cards = [];
  else if (resolvedBase === 'match') next.pairs = [];
  else next.items = [];
  return next;
}

/**
 * Create a lesson with sample content for the selected type ids (order preserved).
 * @param {string} levelId
 * @param {string[]} typeIds
 * @param {string} [id]
 */
export function createSampleLesson(levelId, typeIds, id = 'sample-lesson') {
  const types = (typeIds || []).filter((t) => SAMPLE_EXERCISES[t]);
  if (!types.length) {
    throw new Error('Chọn ít nhất một dạng bài mẫu');
  }

  const exercises = types.map((type, i) => createSampleExercise(type, id, i + 1));
  const labels = types.map((t) => exerciseTypes[t]?.label || t);

  const title =
    types.length === 1
      ? `Sample — ${labels[0]}`
      : types.length === BUILTIN_ORDER.length
        ? 'Demo — All activity types'
        : `Sample — ${labels.slice(0, 2).join(' + ')}${labels.length > 2 ? ` +${labels.length - 2}` : ''}`;

  const summary =
    types.length === 1
      ? `Mẫu dạng «${labels[0]}» — mở để xem cách chơi và cấu trúc nội dung.`
      : `Mẫu ${types.length} dạng bài: ${labels.join(', ')}.`;

  return {
    id,
    levelId,
    title,
    summary,
    body:
      types.length === 1
        ? `This lesson shows how «${labels[0]}» works. Open the Editor to see the content format / Excel columns.`
        : 'Try each activity. Teachers: open in the Editor to copy the content structure for each type.',
    tip: 'In the Editor, use “Tải mẫu Excel” on each activity for a ready-to-fill spreadsheet.',
    exercises,
  };
}

/** Full demo with every built-in type (kept for data/lessons.json). */
export function createAllTypesDemoLesson(levelId, id = 'demo-all-types') {
  return createSampleLesson(levelId, [...BUILTIN_ORDER], id);
}
