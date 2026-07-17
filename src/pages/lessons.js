import { site } from '../../data/site.js';
import { pages } from '../../data/pages.js';
import { levels, getLessonsByLevel, getLevelById } from '../../data/lessons.js';
import { mountChrome } from '../components/chrome.js';
import { levelCardsHtml, levelDetailHtml } from '../components/lessons.js';
import { escapeHtml, setTitle } from '../utils.js';

mountChrome();
setTitle('Lessons', site);

const { title, description } = pages.lessons;
const main = document.getElementById('main');

main.innerHTML = `
  <header class="page-hero page-hero--compact">
    <div class="container">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </div>
  </header>
  <section class="section section--tight">
    <div class="container" data-lessons-root>
      ${levelCardsHtml(levels, getLessonsByLevel)}
    </div>
  </section>
`;

const root = main.querySelector('[data-lessons-root]');

function readHashLevel() {
  const id = window.location.hash.replace(/^#/, '');
  return id && getLevelById(id) ? id : null;
}

function setHash(levelId) {
  if (levelId) {
    history.replaceState(null, '', `#${levelId}`);
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function applyFilters(detail) {
  const input = detail.querySelector('[data-filter-q]');
  const q = (input?.value ?? '').trim().toLowerCase();
  const activeType =
    detail.querySelector('.filter-chip.is-active')?.dataset.filterType ?? 'all';
  const items = [...detail.querySelectorAll('[data-lesson-list] .lesson-item')];
  let visible = 0;

  items.forEach((item) => {
    const haystack = (item.getAttribute('data-search') ?? '').toLowerCase();
    const types = (item.getAttribute('data-types') ?? '').split(/\s+/).filter(Boolean);
    const matchQ = !q || haystack.includes(q);
    const matchType = activeType === 'all' || types.includes(activeType);
    const show = matchQ && matchType;
    item.toggleAttribute('hidden', !show);
    if (show) visible += 1;
  });

  const countEl = detail.querySelector('[data-filter-count]');
  const emptyEl = detail.querySelector('[data-filter-empty]');
  if (countEl) {
    countEl.textContent =
      activeType === 'all' && !q
        ? `${visible} topics`
        : `${visible} matching lessons`;
  }
  if (emptyEl) emptyEl.toggleAttribute('hidden', visible > 0);
}

function bindDetailFilters(detail) {
  const input = detail.querySelector('[data-filter-q]');
  const onFilter = () => applyFilters(detail);

  input?.addEventListener('input', onFilter);
  input?.addEventListener('search', onFilter);
  input?.addEventListener('keyup', onFilter);

  detail.querySelectorAll('[data-filter-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      detail.querySelectorAll('[data-filter-type]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      applyFilters(detail);
    });
  });

  applyFilters(detail);
}

function showLevels() {
  setHash('');
  root.innerHTML = levelCardsHtml(levels, getLessonsByLevel);
  bindLevelCards();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLevel(levelId) {
  const level = getLevelById(levelId);
  if (!level) {
    showLevels();
    return;
  }
  const lessons = getLessonsByLevel(level.id);
  setHash(level.id);
  root.innerHTML = levelDetailHtml(level, lessons);
  bindDetailFilters(root.querySelector('[data-level-detail]'));
  root.querySelector('[data-back-levels]')?.addEventListener('click', showLevels);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindLevelCards() {
  root.querySelectorAll('[data-open-level]').forEach((btn) => {
    btn.addEventListener('click', () => showLevel(btn.dataset.openLevel));
  });
}

bindLevelCards();

const initial = readHashLevel();
if (initial) showLevel(initial);

window.addEventListener('hashchange', () => {
  const id = readHashLevel();
  if (id) showLevel(id);
  else showLevels();
});
