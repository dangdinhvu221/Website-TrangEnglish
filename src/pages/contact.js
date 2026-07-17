import { site } from '../../data/site.js';
import { pages } from '../../data/pages.js';
import { mountChrome } from '../components/chrome.js';
import { escapeHtml, initReveal, setTitle } from '../utils.js';

mountChrome();
setTitle('Contact', site);

const { title, description, form } = pages.contact;
const { contact } = site;

document.getElementById('main').innerHTML = `
  <header class="page-hero">
    <div class="container reveal">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </div>
  </header>
  <section class="section">
    <div class="container contact-layout">
      <form class="form reveal" id="contact-form" novalidate>
        <div class="field">
          <label for="name">${escapeHtml(form.nameLabel)}</label>
          <input id="name" name="name" type="text" autocomplete="name" required />
        </div>
        <div class="field">
          <label for="email">${escapeHtml(form.emailLabel)}</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="message">${escapeHtml(form.messageLabel)}</label>
          <textarea id="message" name="message" required></textarea>
        </div>
        <button class="btn btn--primary" type="submit">${escapeHtml(form.submitLabel)}</button>
        <p class="form__note">${escapeHtml(form.note)}</p>
      </form>

      <aside class="contact-aside reveal reveal-delay-1">
        <dl>
          <dt>Email</dt>
          <dd><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></dd>
          <dt>Phone</dt>
          <dd>${escapeHtml(contact.phone)}</dd>
          <dt>Location</dt>
          <dd>${escapeHtml(contact.address)}</dd>
          <dt>Hours</dt>
          <dd>${escapeHtml(contact.hours)}</dd>
        </dl>
      </aside>
    </div>
  </section>
`;

const formEl = document.getElementById('contact-form');
formEl?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(formEl);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim();
  const message = String(data.get('message') || '').trim();

  if (!name || !email || !message) {
    formEl.reportValidity();
    return;
  }

  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
  ].join('\n');

  const subject = encodeURIComponent(contact.mailtoSubject);
  const encodedBody = encodeURIComponent(body);
  window.location.href = `mailto:${contact.email}?subject=${subject}&body=${encodedBody}`;
});

initReveal();
