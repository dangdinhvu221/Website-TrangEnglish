import { site } from '@data/site.js';
import { pages } from '@data/pages.js';
import { mountChrome } from '@/components/chrome.js';
import { escapeHtml, initReveal, setTitle } from '@/utils.js';

mountChrome();
setTitle('About', site);

const { title, paragraphs, values } = pages.about;

document.getElementById('main').innerHTML = `
  <header class="page-hero">
    <div class="container reveal">
      <h1>${escapeHtml(title)}</h1>
    </div>
  </header>
  <section class="section">
    <div class="container">
      <div class="prose reveal">
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      </div>
      <h2 class="reveal" style="margin-top: 3rem">${escapeHtml(values.title)}</h2>
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
        <h2>${escapeHtml(site.tagline)}</h2>
        <p>Browse lessons and practice one topic at a time.</p>
      </div>
      <a class="btn btn--primary" href="${escapeHtml(site.primaryCta.href)}">${escapeHtml(site.primaryCta.label)}</a>
    </div>
  </section>
`;

initReveal();
