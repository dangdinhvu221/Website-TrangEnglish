/**
 * Shared helpers: path matching, escaping, motion.
 */

/** Normalize path for active nav highlighting. */
export function currentPath() {
  let path = window.location.pathname;
  if (path.endsWith('/index.html')) path = '/';
  if (path.endsWith('/')) path = path.slice(0, -1) || '/';
  return path === '' ? '/' : path;
}

/** True if nav href matches current page. */
export function isActiveNav(href) {
  const path = currentPath();
  const clean = href.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  if (clean === '/' || clean === '') return path === '/' || path === '';
  // Keep "Lessons" active on lesson detail pages
  if (clean.includes('lessons') && /lesson\.html/i.test(path)) return true;
  return path.endsWith(clean) || path.endsWith(clean.replace('.html', ''));
}

/** Escape text for safe HTML interpolation. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Fade/slide elements with .reveal when they enter the viewport. */
export function initReveal() {
  const nodes = document.querySelectorAll('.reveal');
  if (!nodes.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  nodes.forEach((el) => observer.observe(el));
}

/** Set document title from page name + site suffix. */
export function setTitle(pageName, site) {
  document.title = `${pageName} — ${site.titleSuffix}`;
}
