/**
 * Lesson catalog — content lives in lessons.json (edit via /editor.html or by hand).
 * This file only loads data and provides helpers used by the site.
 */

import catalog from './lessons.json';
import {
  BUILTIN_ORDER,
  getExerciseType,
  setCustomTypes,
} from './exercise-types.js';

setCustomTypes(catalog.customTypes || []);

export const levels = catalog.levels;
export const lessons = catalog.lessons;
export const customTypes = catalog.customTypes || [];

export function getLessonById(id) {
  return lessons.find((lesson) => lesson.id === id) ?? null;
}

export function getLevelById(id) {
  return levels.find((level) => level.id === id) ?? null;
}

export function getLessonsByLevel(levelId) {
  return lessons.filter((lesson) => lesson.levelId === levelId);
}

/** Unique exercise type ids used in a lesson (built-ins first, then customs). */
export function getLessonTypeIds(lesson) {
  const used = new Set((lesson.exercises ?? []).map((ex) => ex.type));
  const builtinUsed = BUILTIN_ORDER.filter((id) => used.has(id));
  const customUsed = (catalog.customTypes || [])
    .map((t) => t.id)
    .filter((id) => used.has(id));
  const known = new Set([...BUILTIN_ORDER, ...customUsed]);
  const orphans = [...used].filter((id) => !known.has(id));
  return [...builtinUsed, ...customUsed, ...orphans];
}

export function getLessonTypes(lesson) {
  return getLessonTypeIds(lesson).map(getExerciseType);
}
