/**
 * Full-page loading overlay for multi-page navigation.
 */

const LOADER_ID = 'page-loader';
let mounted = false;

function ensureLoader() {
  if (document.getElementById(LOADER_ID)) return;
  const el = document.createElement('div');
  el.id = LOADER_ID;
  el.className = 'page-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="page-loader__panel">
      <div class="page-loader__spinner" aria-hidden="true"></div>
      <p class="page-loader__label">Loading…</p>
    </div>
  `;
  document.body.appendChild(el);
}

export function showPageLoader() {
  ensureLoader();
  const el = document.getElementById(LOADER_ID);
  document.body.classList.add('is-page-loading');
  el?.classList.add('is-visible');
  el?.setAttribute('aria-hidden', 'false');
  el?.setAttribute('aria-busy', 'true');
}

export function hidePageLoader() {
  const el = document.getElementById(LOADER_ID);
  document.body.classList.remove('is-page-loading');
  el?.classList.remove('is-visible');
  el?.setAttribute('aria-hidden', 'true');
  el?.setAttribute('aria-busy', 'false');
}

function isInternalNavLink(anchor) {
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
  const href = anchor.getAttribute('href');
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  ) {
    return false;
  }
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  const samePath =
    url.pathname === window.location.pathname && url.search === window.location.search;
  if (samePath && url.hash) return false;
  if (url.href === window.location.href) return false;
  return true;
}

function onDocumentClick(event) {
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest?.('a[href]');
  if (!isInternalNavLink(anchor)) return;
  showPageLoader();
}

function hideWhenReady() {
  showPageLoader();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => hidePageLoader());
    });
  };

  if (document.readyState === 'complete') {
    finish();
  } else {
    window.addEventListener('load', finish, { once: true });
  }
  window.setTimeout(finish, 2200);
}

/** Call once from mountChrome on every page. */
export function mountPageLoader() {
  if (mounted) return;
  mounted = true;
  ensureLoader();
  hideWhenReady();
  document.addEventListener('click', onDocumentClick, true);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) hidePageLoader();
  });
}
