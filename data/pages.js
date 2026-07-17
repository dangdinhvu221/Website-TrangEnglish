/**
 * Page-specific copy — home, about, contact, lessons listing.
 * Layouts read these fields; change text here only.
 */

export const pages = {
  home: {
    // Hero (first viewport): brand comes from site.name
    hero: {
      headline: 'Fun English practice',
      description:
        'Level 1 & Level 2 — flashcards, picture chase, match, sentence building, and writing. Students love to tap; teachers can share a link.',
    },

    // One purpose: why this site exists
    intro: {
      title: 'Learn through play',
      text: 'Flashcards, picture chase, match, sentence building, and writing — pick an activity and practise. Teachers only need to open a link.',
    },

    // Featured lessons section (ids must match lessons.js)
    featured: {
      title: 'Try these',
      text: 'A few topics with interactive exercises ready to go.',
      lessonIds: ['colours', 'numbers-1-20', 'school-life', 'daily-routine'],
    },

    // Bottom CTA band
    ctaBand: {
      title: 'Ready for class?',
      text: 'Choose Level 1 or Level 2 — assign varied exercises in minutes.',
      buttonLabel: 'Browse lessons',
      buttonHref: '/lessons.html',
    },
  },

  lessons: {
    title: 'Lessons by level',
    description: 'Choose Level 1 or Level 2 to see topics. Filter by exercise type anytime.',
  },

  about: {
    title: 'About Trang English',
    paragraphs: [
      'Trang English helps teachers assign Level 1 & Level 2 English practice in a clear, engaging way.',
      'Students practise in the browser: flashcards, picture chase, matching, sentence building, and writing — no app install needed.',
      'All content lives in data files, so you can edit quickly before class.',
    ],
    values: {
      title: 'Why it works',
      items: [
        {
          title: 'Many activity types',
          text: 'Not just reading — short games that make students want to keep going.',
        },
        {
          title: 'Easy to spot and use',
          text: 'Clear colours, big buttons, and instant right/wrong feedback.',
        },
        {
          title: 'Easy to update',
          text: 'Change questions in data/lessons.js — no layout edits needed.',
        },
      ],
    },
  },

  contact: {
    title: 'Get in touch',
    description:
      'Questions about lessons, partnerships, or feedback? Send a note — we read every message.',
    // Form is UI-only: submit builds a mailto: link
    form: {
      nameLabel: 'Your name',
      emailLabel: 'Email',
      messageLabel: 'Message',
      submitLabel: 'Open email app',
      note: 'This form opens your email app with the message filled in. Nothing is sent to a server.',
    },
  },
};
