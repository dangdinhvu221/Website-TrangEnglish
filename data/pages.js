/**
 * Page-specific copy — home, about, contact, lessons listing.
 * Layouts read these fields; change text here only.
 */

export const pages = {
  home: {
    // Hero (first viewport): brand comes from site.name
    hero: {
      headline: 'English practice that feels clear and doable',
      description:
        'Structured Level 1 and Level 2 activities — from vocabulary and matching to sentence building and writing — so learners can practise with confidence, anywhere in the browser.',
    },

    // One purpose: why this site exists
    intro: {
      title: 'Built for steady progress',
      text: 'Each lesson combines short, focused activities that reinforce vocabulary, meaning, and everyday English. Learners get instant feedback; teachers get a simple link to share before or after class.',
    },

    // Featured lessons section (ids must match lessons.js)
    featured: {
      title: 'Featured topics',
      text: 'A selection of ready-to-use lessons across levels — open any topic and start practising straight away.',
      lessonIds: ['colours', 'numbers-1-20', 'school-life', 'daily-routine'],
    },

    // Bottom CTA band
    ctaBand: {
      title: 'Ready to begin?',
      text: 'Browse by level, choose a topic, and guide learners through interactive practice in minutes.',
      buttonLabel: 'View all lessons',
      buttonHref: '/lessons.html',
    },
  },

  lessons: {
    title: 'Lessons by level',
    description:
      'Select Level 1 or Level 2 to explore topics. Use the filters anytime to find activities by type — flashcards, matching, writing, and more.',
  },

  about: {
    title: 'About Trang English',
    lead: 'A focused English practice platform for young and developing learners — clear, interactive, and ready for classroom or home use.',
    paragraphs: [
      'Trang English supports Level 1 and Level 2 learners with short, purposeful activities: flashcards, picture recognition, multiple choice, true or false, sentence building, ordering, matching, writing, and fill-in-the-blank.',
      'Everything runs in the browser — no app install required. Teachers can assign a lesson link, and learners practise with immediate feedback that keeps motivation high.',
      'Content is organised by level and topic so progress stays visible: build vocabulary, strengthen sentence sense, and grow confidence using everyday English.',
    ],
    teacher: {
      eyebrow: 'The teacher',
      name: 'Teacher Trang',
      role: 'English educator · Founder of Trang English',
      paragraphs: [
        'Teacher Trang designs learning experiences that are simple to follow and meaningful to practise. With a clear classroom focus, she created Trang English so learners can revisit lessons independently while teachers keep full control of the content.',
        'Based in Hanoi, she works with Level 1 and Level 2 learners who need structure, encouragement, and activities that feel engaging — not overwhelming. Her approach emphasises clarity, repetition with purpose, and confidence in speaking and writing English.',
      ],
    },
    values: {
      title: 'What we stand for',
      items: [
        {
          title: 'Clarity first',
          text: 'Short instructions, readable layouts, and activities that learners can understand without friction.',
        },
        {
          title: 'Practice that sticks',
          text: 'Varied exercise types keep attention high while reinforcing the same language from different angles.',
        },
        {
          title: 'Ready for teachers',
          text: 'Update lessons quickly, share a link, and keep class prep light — without rebuilding the website.',
        },
      ],
    },
    closing: {
      title: 'Clear English. Confident learners.',
      text: 'Explore the lesson library and practise one focused topic at a time.',
    },
  },

  contact: {
    title: 'Contact',
    description:
      'For lesson enquiries, class arrangements, partnerships, or feedback — please get in touch. Every message is read carefully.',
    // Form is UI-only: submit builds a mailto: link
    form: {
      nameLabel: 'Full name',
      emailLabel: 'Email address',
      messageLabel: 'Your message',
      submitLabel: 'Open email app',
      note: 'This form opens your email app with your message prepared. Nothing is stored on a server.',
    },
  },
};
