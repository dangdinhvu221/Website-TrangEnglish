/**
 * Site-wide config — brand, nav, CTAs, footer, contact.
 * Edit this file to change global content without touching HTML/CSS.
 */

export const site = {
  // Display name shown in nav + hero
  name: 'Trang English',

  // Short phrase under the brand (hero & about)
  tagline: 'Speak clearly. Think in English.',

  // Browser tab title suffix: "Home — Trang English"
  titleSuffix: 'Trang English',

  // Primary action (buttons across the site)
  primaryCta: {
    label: 'Start learning',
    href: '/lessons.html',
  },

  // Secondary action on the home hero
  secondaryCta: {
    label: 'About us',
    href: '/about.html',
  },

  // Top navigation — order = display order
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Lessons', href: '/lessons.html' },
    { label: 'About', href: '/about.html' },
    { label: 'Contact', href: '/contact.html' },
    { label: 'Editor', href: '/editor.html' },
  ],

  // Footer copy
  footer: {
    blurb: 'English practice for Level 1 & Level 2 — fun, clear, and ready in the browser.',
    copyright: '© 2026 Trang English. All rights reserved.',
  },

  // Contact page + footer links
  contact: {
    email: 'trangEnglish@gmail.com',
    // Opens the user's email app (no backend)
    mailtoSubject: 'Question about Trang English',
    phone: '+84 363 784 511',
    address: 'Hoa Chinh, Hanoi',
    hours: 'Mon–Fri, 9:00–17:00 (GMT+7)',
  },

  // Social links (leave empty array to hide)
  social: [
    { label: 'YouTube', href: 'https://youtube.com' },
    { label: 'Facebook', href: 'https://facebook.com' },
  ],
};
