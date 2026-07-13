// Shared helpers for the LadyDawgs schedule API, backed by Vercel KV
// (Upstash Redis marketplace integration). The leading underscore keeps
// Vercel from treating this file as a route.

const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const EVENTS_KEY = 'ladydawgs:events';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// The two entries that were originally hardcoded on the site. Returned when
// the KV key does not exist yet, and used to seed KV on the first write.
const DEFAULT_EVENTS = [
  {
    id: 'seed-trivia',
    position: 0,
    day_label: 'Thu, Jun 11',
    title: 'Trivia & LadyDawgs',
    details: "High Y'all, 4809 Trousdale Dr, Nashville, TN",
    time_text: '6:30 to 8:30 PM',
    link_url: null,
    link_label: null,
    is_standing: false,
  },
  {
    id: 'seed-instagram',
    position: 1,
    day_label: 'Always',
    title: 'Follow @la_ladydawgs',
    details: 'Daily location updates on Instagram',
    time_text: '',
    link_url: null,
    link_label: null,
    is_standing: true,
  },
];

// Build the Redis client from whichever env vars the store injected.
// Vercel's Upstash/KV marketplace integration sets KV_REST_API_URL /
// KV_REST_API_TOKEN; a bare Upstash integration sets UPSTASH_REDIS_REST_*.
function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('KV is not configured (need KV_REST_API_URL and KV_REST_API_TOKEN).');
  }
  return new Redis({ url, token });
}

// Normalize whatever came back from KV into an array of events.
function toArray(stored) {
  if (Array.isArray(stored)) return stored;
  if (stored && Array.isArray(stored.events)) return stored.events;   // tolerate {events:[...]} shape
  if (typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.events)) return parsed.events;
    } catch { /* fall through */ }
  }
  return null;
}

// Read the raw (unsorted) events. Falls back to a copy of the defaults if the
// key is missing, so both reads and first writes start from a sensible base.
async function readRaw(redis) {
  const stored = await redis.get(EVENTS_KEY);
  const arr = toArray(stored);
  return arr || DEFAULT_EVENTS.map(e => ({ ...e }));
}

// Read events sorted for display.
async function getEvents(redis) {
  const events = await readRaw(redis);
  return events
    .slice()
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
}

// Persist the whole events array.
async function saveEvents(redis, events) {
  await redis.set(EVENTS_KEY, events);
}

// Constant-time password comparison so we never leak length/timing info.
function passwordOk(supplied) {
  if (!ADMIN_PASSWORD) return false;              // fail closed if misconfigured
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Read the JSON body. Vercel usually parses it for us, but when the function
// runs outside that pipeline (or the header is missing) we parse manually.
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return {}; }
}

// Only expose safe, display-facing columns to the browser.
function publicShape(row) {
  return {
    id: row.id,
    position: row.position,
    day_label: row.day_label,
    title: row.title,
    details: row.details,
    time_text: row.time_text,
    link_url: row.link_url ?? null,
    link_label: row.link_label ?? null,
    is_standing: Boolean(row.is_standing),
  };
}

module.exports = {
  kv,
  getEvents,
  readRaw,
  saveEvents,
  passwordOk,
  readJsonBody,
  publicShape,
  newId: () => crypto.randomUUID(),
  DEFAULT_EVENTS,
  EVENTS_KEY,
};
