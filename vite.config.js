import { defineConfig } from 'vite';
import { resolve } from 'path';
import { lessonsApiPlugin } from './scripts/lessons-api.js';

const root = __dirname;
// GitHub Actions → Pages URL: https://dangdinhvu221.github.io/Website-TrangEnglish/
const pagesBase = process.env.GITHUB_ACTIONS ? '/Website-TrangEnglish/' : '/';

export default defineConfig({
  root: '.',
  base: pagesBase,
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@data': resolve(root, 'data'),
    },
  },
  plugins: [lessonsApiPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        lessons: resolve(root, 'lessons.html'),
        lesson: resolve(root, 'lesson.html'),
        about: resolve(root, 'about.html'),
        contact: resolve(root, 'contact.html'),
        editor: resolve(root, 'editor.html'),
      },
    },
  },
});
