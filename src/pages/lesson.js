import { site } from '@data/site.js';
import { getLessonById, getLevelById } from '@data/lessons.js';
import { getExerciseType } from '@data/exercise-types.js';
import { mountChrome } from '@/components/chrome.js';
import { mountExercise } from '@/exercises/index.js';
import { escapeHtml, initReveal, setTitle, withBase } from '@/utils.js';

mountChrome();

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const lesson = id ? getLessonById(id) : null;
const main = document.getElementById('main');

if (!lesson) {
  setTitle('Lesson not found', site);
  main.innerHTML = `
    <section class="section not-found">
      <div class="container reveal">
        <h1>Lesson not found</h1>
        <p>That topic does not exist. Check the link or browse all lessons.</p>
        <p><a class="btn btn--outline" href="${escapeHtml(withBase('/lessons.html'))}">Back to lessons</a></p>
      </div>
    </section>
  `;
  initReveal();
} else {
  const level = getLevelById(lesson.levelId);
  const levelLabel = level?.name ?? lesson.levelId;
  const backHref = level ? withBase(`/lessons.html#${level.id}`) : withBase('/lessons.html');
  const backLabel = level ? `← ${level.name}` : '← Lessons';
  const exercises = lesson.exercises ?? [];

  setTitle(lesson.title, site);
  main.innerHTML = `
    <article class="lesson-play" data-lesson-play>
      <div class="container lesson-play__wrap">
        <a class="back-link" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>

        <header class="lesson-play__intro" data-intro>
          <span class="lesson-detail__meta">${escapeHtml(levelLabel)}</span>
          <h1>${escapeHtml(lesson.title)}</h1>
          <p class="lesson-play__desc">${escapeHtml(lesson.body)}</p>
        </header>

        <section class="lesson-play__picker" data-picker aria-label="Choose an activity">
          <h2 class="lesson-play__picker-title">Choose an activity</h2>
          <ul class="activity-list">
            ${exercises
              .map((ex, i) => {
                const type = getExerciseType(ex.type);
                return `
                  <li>
                    <button type="button" class="activity-row activity-row--${escapeHtml(ex.type)}" data-ex="${i}">
                      <span class="activity-row__type">${escapeHtml(type.label)}</span>
                      <span class="activity-row__title">${escapeHtml(ex.title)}</span>
                      <span class="activity-row__go" aria-hidden="true">→</span>
                    </button>
                  </li>
                `;
              })
              .join('')}
          </ul>
          ${
            lesson.tip
              ? `<p class="lesson-play__tip"><strong>Tip:</strong> ${escapeHtml(lesson.tip)}</p>`
              : ''
          }
        </section>

        <section class="ex-panel" id="exercise-stage" data-stage hidden>
          <div class="ex-panel__bar">
            <button type="button" class="ex-panel__back" data-close-ex>← Back</button>
            <span class="ex-panel__type" data-ex-type></span>
          </div>
          <h2 class="ex-panel__title" data-ex-title></h2>
          <p class="ex-panel__prompt" data-ex-prompt></p>
          <div class="ex-panel__body" data-ex-root></div>
        </section>
      </div>
    </article>
  `;

  const article = main.querySelector('[data-lesson-play]');
  const stage = main.querySelector('[data-stage]');
  const picker = main.querySelector('[data-picker]');
  const intro = main.querySelector('[data-intro]');
  const root = main.querySelector('[data-ex-root]');
  const titleEl = main.querySelector('[data-ex-title]');
  const promptEl = main.querySelector('[data-ex-prompt]');
  const typeEl = main.querySelector('[data-ex-type]');
  const rows = [...main.querySelectorAll('.activity-row')];

  function openExercise(index) {
    const exercise = exercises[index];
    if (!exercise) return;
    const type = getExerciseType(exercise.type);

    rows.forEach((row, i) => row.classList.toggle('is-active', i === index));
    typeEl.textContent = type.label;
    typeEl.className = `ex-panel__type ex-panel__type--${exercise.type}`;
    titleEl.textContent = exercise.title;
    promptEl.textContent = exercise.prompt ?? '';
    promptEl.hidden = !exercise.prompt;

    article.classList.add('is-playing');
    picker.hidden = true;
    intro.hidden = true;
    stage.hidden = false;
    mountExercise(root, exercise);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeExercise() {
    article.classList.remove('is-playing');
    picker.hidden = false;
    intro.hidden = false;
    stage.hidden = true;
    root.innerHTML = '';
    rows.forEach((row) => row.classList.remove('is-active'));
  }

  rows.forEach((row) => {
    row.addEventListener('click', () => openExercise(Number(row.dataset.ex)));
  });

  main.querySelector('[data-close-ex]')?.addEventListener('click', closeExercise);
}
