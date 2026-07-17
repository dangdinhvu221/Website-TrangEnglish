import { site } from '@data/site.js';
import { pages } from '@data/pages.js';
import { lessons } from '@data/lessons.js';
import { mountChrome } from '@/components/chrome.js';
import { lessonListHtml } from '@/components/lessons.js';
import { escapeHtml, initReveal, setTitle, withBase } from '@/utils.js';

mountChrome();
setTitle('Home', site);

const { hero, intro, featured, ctaBand } = pages.home;
const featuredLessons = featured.lessonIds
  .map((id) => lessons.find((l) => l.id === id))
  .filter(Boolean);

document.getElementById('main').innerHTML = `
  <section class="hero" aria-label="Introduction">
    <div class="container hero__content">
      <p class="hero__brand">${escapeHtml(site.name)}</p>
      <h1 class="hero__headline">${escapeHtml(hero.headline)}</h1>
      <p class="hero__desc">${escapeHtml(hero.description)}</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="${escapeHtml(withBase(site.primaryCta.href))}">${escapeHtml(site.primaryCta.label)}</a>
        <a class="btn btn--ghost" href="${escapeHtml(withBase(site.secondaryCta.href))}">${escapeHtml(site.secondaryCta.label)}</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section__header reveal">
        <h2>${escapeHtml(intro.title)}</h2>
        <p>${escapeHtml(intro.text)}</p>
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="container">
      <div class="section__header reveal">
        <h2>${escapeHtml(featured.title)}</h2>
        <p>${escapeHtml(featured.text)}</p>
      </div>
      ${lessonListHtml(featuredLessons)}
      <p class="reveal reveal-delay-1" style="margin-top: 2rem">
        <a class="btn btn--outline" href="${escapeHtml(withBase('/lessons.html'))}">View all lessons</a>
      </p>
    </div>
  </section>

  <section class="section section--deep">
    <div class="container reveal">
      <div class="section__header">
        <h2>${escapeHtml(ctaBand.title)}</h2>
        <p>${escapeHtml(ctaBand.text)}</p>
      </div>
      <a class="btn btn--primary" href="${escapeHtml(withBase(ctaBand.buttonHref))}">${escapeHtml(ctaBand.buttonLabel)}</a>
    </div>
  </section>
`;

initReveal();
