import { defineConfig } from 'vite';
import { resolve } from 'path';
import { lessonsApiPlugin } from './vite.lessons-api.js';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [lessonsApiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lessons: resolve(__dirname, 'lessons.html'),
        lesson: resolve(__dirname, 'lesson.html'),
        about: resolve(__dirname, 'about.html'),
        contact: resolve(__dirname, 'contact.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
});
