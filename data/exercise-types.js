/**
 * Exercise type catalog — labels shown on lesson list & activity picker.
 * Keep ids stable: flip | picture | sentence | match | write
 */

export const exerciseTypes = {
  flip: {
    id: 'flip',
    label: 'Flashcards',
    blurb: 'Flip cards to remember words',
  },
  picture: {
    id: 'picture',
    label: 'Picture chase',
    blurb: 'Look at the picture, pick the word',
  },
  sentence: {
    id: 'sentence',
    label: 'Build a sentence',
    blurb: 'Catch words and make a full sentence',
  },
  match: {
    id: 'match',
    label: 'Match',
    blurb: 'Match the pairs',
  },
  write: {
    id: 'write',
    label: 'Write',
    blurb: 'Type the answer in English',
  },
};

export function getExerciseType(typeId) {
  return exerciseTypes[typeId] ?? {
    id: typeId,
    label: typeId,
    blurb: '',
  };
}
