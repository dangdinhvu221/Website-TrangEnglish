/**
 * Lesson catalog — content lives in lessons.json (edit via /editor.html or by hand).
 * This file only loads data and provides helpers used by the site.
 */

import catalog from './lessons.json';
import { getExerciseType } from './exercise-types.js';

export const levels = catalog.levels;
export const lessons = catalog.lessons;

export function getLessonById(id) {
  return lessons.find((lesson) => lesson.id === id) ?? null;
}

export function getLevelById(id) {
  return levels.find((level) => level.id === id) ?? null;
}

export function getLessonsByLevel(levelId) {
  return lessons.filter((lesson) => lesson.levelId === levelId);
}

/** Unique exercise type ids used in a lesson (catalog order). */
export function getLessonTypeIds(lesson) {
  const order = ['flip', 'picture', 'sentence', 'match', 'write'];
  const used = new Set((lesson.exercises ?? []).map((ex) => ex.type));
  return order.filter((id) => used.has(id));
}

export function getLessonTypes(lesson) {
  return getLessonTypeIds(lesson).map(getExerciseType);
}
