import { site } from '@data/site.js';
import { escapeHtml, isActiveNav, withBase } from '@/utils.js';
import { mountPageLoader } from './page-loader.js';

function navLinks(extraClass = '') {
  return site.nav
    .map((item) => {
      const current = isActiveNav(item.href) ? ' aria-current="page"' : '';
      return `<a href="${escapeHtml(withBase(item.href))}"${current}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
}

export function renderHeader(target) {
  target.innerHTML = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="${escapeHtml(withBase('/'))}">${escapeHtml(site.name)}</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
          Menu
        </button>
        <nav id="primary-nav" class="nav" aria-label="Primary">
          ${navLinks()}
        </nav>
      </div>
    </header>
  `;

  const toggle = target.querySelector('.nav-toggle');
  const nav = target.querySelector('.nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

export function renderFooter(target) {
  const social =
    site.social?.length > 0
      ? `<div class="footer-nav">${site.social
          .map(
            (s) =>
              `<a href="${escapeHtml(s.href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(s.label)}</a>`,
          )
          .join('')}</div>`
      : '';

  target.innerHTML = `
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <div>
          <a class="brand" href="${escapeHtml(withBase('/'))}">${escapeHtml(site.name)}</a>
          <p>${escapeHtml(site.footer.blurb)}</p>
        </div>
        <div>
          <nav class="footer-nav" aria-label="Footer">
            ${navLinks()}
          </nav>
          ${social}
          <p class="footer-meta">${escapeHtml(site.footer.copyright)}</p>
        </div>
      </div>
    </footer>
  `;
}


/** Mount header + footer into #site-header / #site-footer. */
export function mountChrome() {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) renderHeader(header);
  if (footer) renderFooter(footer);
  mountPageLoader();
}
