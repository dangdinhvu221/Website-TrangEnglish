import { site } from '@data/site.js';
import { pages } from '@data/pages.js';
import { mountChrome } from '@/components/chrome.js';
import { escapeHtml, initReveal, setTitle, withBase } from '@/utils.js';

mountChrome();
setTitle('About', site);

const { title, lead, paragraphs, teacher, values, closing } = pages.about;

document.getElementById('main').innerHTML = `
  <header class="page-hero">
    <div class="container reveal">
      <h1>${escapeHtml(title)}</h1>
      ${lead ? `<p class="page-hero__lead">${escapeHtml(lead)}</p>` : ''}
    </div>
  </header>

  <section class="section">
    <div class="container">
      <div class="prose reveal">
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      </div>
    </div>
  </section>

  ${
    teacher
      ? `
  <section class="section section--tight about-teacher">
    <div class="container">
      <div class="about-teacher__panel reveal">
        <p class="about-teacher__eyebrow">${escapeHtml(teacher.eyebrow)}</p>
        <h2 class="about-teacher__name">${escapeHtml(teacher.name)}</h2>
        <p class="about-teacher__role">${escapeHtml(teacher.role)}</p>
        <div class="prose about-teacher__bio">
          ${teacher.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      </div>
    </div>
  </section>`
      : ''
  }

  <section class="section">
    <div class="container">
      <h2 class="reveal">${escapeHtml(values.title)}</h2>
      <div class="values">
        ${values.items
          .map(
            (item, i) => `
          <div class="reveal reveal-delay-${Math.min(i + 1, 2)}">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  </section>

  <section class="section section--deep">
    <div class="container reveal">
      <div class="section__header">
        <h2>${escapeHtml(closing?.title || site.tagline)}</h2>
        <p>${escapeHtml(closing?.text || 'Browse lessons and practise one topic at a time.')}</p>
      </div>
      <a class="btn btn--primary" href="${escapeHtml(withBase(site.primaryCta.href))}">${escapeHtml(site.primaryCta.label)}</a>
    </div>
  </section>
`;

initReveal();
