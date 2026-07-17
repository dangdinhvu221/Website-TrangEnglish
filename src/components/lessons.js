import { escapeHtml } from '../utils.js';
import { getLessonTypes, getLessonTypeIds } from '../../data/lessons.js';
import { exerciseTypes } from '../../data/exercise-types.js';

/** Compact lesson row with activity-type badges. */
export function lessonItemHtml(lesson) {
  const types = getLessonTypes(lesson);
  const typeIds = getLessonTypeIds(lesson).join(' ');
  const badges = types
    .map(
      (t) =>
        `<span class="type-badge type-badge--${escapeHtml(t.id)}">${escapeHtml(t.label)}</span>`,
    )
    .join('');

  return `
    <a class="lesson-item" href="/lesson.html?id=${escapeHtml(lesson.id)}" data-types="${escapeHtml(typeIds)}" data-search="${escapeHtml(`${lesson.title} ${lesson.summary}`.toLowerCase())}">
      <div>
        <h3 class="lesson-item__title">${escapeHtml(lesson.title)}</h3>
        <p class="lesson-item__summary">${escapeHtml(lesson.summary)}</p>
        <div class="type-badges">${badges}</div>
      </div>
      <span class="lesson-item__meta">${escapeHtml(String(types.length))} activities</span>
    </a>
  `;
}

export function lessonListHtml(lessonList) {
  if (!lessonList.length) {
    return `<p class="level-empty">No lessons in this level yet.</p>`;
  }
  return `
    <div class="lesson-list" data-lesson-list>
      ${lessonList.map(lessonItemHtml).join('')}
    </div>
  `;
}

/** Top-level grade cards only (Level 1, Level 2). */
export function levelCardsHtml(levels, getLessonsByLevel) {
  return `
    <div class="level-cards" data-level-cards>
      ${levels
        .map((level) => {
          const count = getLessonsByLevel(level.id).length;
          return `
            <button type="button" class="level-card" data-open-level="${escapeHtml(level.id)}">
              <span class="level-card__name">${escapeHtml(level.name)}</span>
              <span class="level-card__title">${escapeHtml(level.title)}</span>
              <span class="level-card__meta">${count} topics · view lessons →</span>
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

/** Filter bar: search + exercise type chips. */
export function filterBarHtml(activeType = 'all') {
  const types = Object.values(exerciseTypes);
  return `
    <div class="filter-bar" data-filter-bar>
      <label class="filter-search">
        <span class="visually-hidden">Search lessons</span>
        <input type="search" data-filter-q placeholder="Search by name…" autocomplete="off" />
      </label>
      <div class="filter-types" role="group" aria-label="Filter by activity type">
        <button type="button" class="filter-chip ${activeType === 'all' ? 'is-active' : ''}" data-filter-type="all">All</button>
        ${types
          .map(
            (t) => `
          <button type="button" class="filter-chip filter-chip--${escapeHtml(t.id)} ${activeType === t.id ? 'is-active' : ''}" data-filter-type="${escapeHtml(t.id)}">
            ${escapeHtml(t.label)}
          </button>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

/** Detail panel for one level: back + filters + lesson list. */
export function levelDetailHtml(level, lessons) {
  return `
    <div class="level-detail" data-level-detail data-level-id="${escapeHtml(level.id)}">
      <button type="button" class="level-detail__back" data-back-levels>← All levels</button>
      <header class="level-detail__head">
        <span class="lesson-detail__meta">${escapeHtml(level.name)}</span>
        <h2>${escapeHtml(level.title)}</h2>
        <p>${escapeHtml(level.description)}</p>
      </header>
      ${filterBarHtml()}
      <p class="filter-count" data-filter-count></p>
      ${lessonListHtml(lessons)}
      <p class="level-empty" data-filter-empty hidden>No lessons match this filter.</p>
    </div>
  `;
}
