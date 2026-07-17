import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_FILE = path.resolve(__dirname, 'data/lessons.json');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function attachLessonsApi(middlewares) {
  middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0];
    if (url !== '/api/lessons') return next();

    try {
      if (req.method === 'GET') {
        const raw = fs.readFileSync(LESSONS_FILE, 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(raw);
        return;
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed?.levels) || !Array.isArray(parsed?.lessons)) {
          sendJson(res, 400, { ok: false, error: 'Body must include levels[] and lessons[]' });
          return;
        }
        const text = `${JSON.stringify(parsed, null, 2)}\n`;
        fs.writeFileSync(LESSONS_FILE, text, 'utf8');
        sendJson(res, 200, { ok: true, path: 'data/lessons.json' });
        return;
      }

      res.statusCode = 405;
      res.setHeader('Allow', 'GET, PUT, POST');
      res.end('Method Not Allowed');
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message || error) });
    }
  });
}

/** Dev API: GET/PUT /api/lessons ↔ data/lessons.json */
export function lessonsApiPlugin() {
  return {
    name: 'lessons-api',
    configureServer(server) {
      attachLessonsApi(server.middlewares);
    },
    configurePreviewServer(server) {
      attachLessonsApi(server.middlewares);
    },
  };
}
