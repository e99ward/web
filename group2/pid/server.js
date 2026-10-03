import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const files = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/app.js': 'app.js', '/simulation.js': 'simulation.js', '/learn': 'learn.html', '/learn.html': 'learn.html', '/learn.css': 'learn.css', '/learn.js': 'learn.js' };
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const content = await readFile(fileURLToPath(new URL(file, root)));
    res.writeHead(200, { 'Content-Type': `${types[file.split('.').pop()]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(500); res.end('Unable to load application'); }
}).listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log(`Furnace Lab → http://localhost:${process.env.PORT || 5173}`));
