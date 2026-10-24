import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Cloudflare proxy config points to the read-only Worker', () => {
  const config = readFileSync(new URL('../wrangler.proxy.toml', import.meta.url), 'utf8');
  assert.match(config, /^name\s*=\s*"anime-scout-proxy"/m);
  assert.match(config, /^main\s*=\s*"cloudflare\/sakuga-proxy\.js"/m);
});

test('Worker exposes the /posts JSON contract and CORS', () => {
  const source = readFileSync(new URL('../cloudflare/sakuga-proxy.js', import.meta.url), 'utf8');
  assert.match(source, /url\.pathname\s*!==\s*"\/posts"/);
  assert.match(source, /ok:\s*true,\s*count:/);
  assert.match(source, /Access-Control-Allow-Origin/);
});
