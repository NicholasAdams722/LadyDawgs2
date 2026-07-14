// Shared helpers for the LadyDawgs schedule API, backed by Vercel KV
// (Upstash Redis marketplace integration). The leading underscore keeps
// Vercel from treating this file as a route.

const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const EVENTS_KEY = 'ladydawgs:events';

// The schedule starts empty. When there are no events, the public page falls
// back to its built-in "Follow @la_ladydawgs" entry, so the section is never
// blank. Events are added by the owner through /admin.
const DEFAULT_EVENTS = [];

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

// Today's date as YYYY-MM-DD in the cart's local time zone (Nashville /
// Central). Used to decide which dated events have already passed.
function currentDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// An event is "past" once its date is strictly before today (so it stays
// visible through the end of its own day, then drops off the next day).
// Standing entries and events without a date are never treated as past.
function isPast(ev, today) {
  if (ev.is_standing) return false;
  if (!ev.event_date) return false;
  return String(ev.event_date) < today;
}

// Read the events and permanently prune any that are past, persisting the
// pruned list back to KV only when something actually changed. Returns the
// remaining (active) events, unsorted.
async function readActive(redis) {
  const events = await readRaw(redis);
  const today = currentDateStr();
  const active = events.filter(e => !isPast(e, today));
  if (active.length !== events.length) {
    await saveEvents(redis, active);
  }
  return active;
}

// Read active events sorted for display.
async function getEvents(redis) {
  const events = await readActive(redis);
  return events
    .slice()
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
}

// Persist the whole events array.
async function saveEvents(redis, events) {
  await redis.set(EVENTS_KEY, events);
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
    event_date: row.event_date ?? null,
    link_url: row.link_url ?? null,
    link_label: row.link_label ?? null,
    is_standing: Boolean(row.is_standing),
  };
}

module.exports = {
  kv,
  getEvents,
  readRaw,
  readActive,
  saveEvents,
  currentDateStr,
  isPast,
  readJsonBody,
  publicShape,
  newId: () => crypto.randomUUID(),
  DEFAULT_EVENTS,
  EVENTS_KEY,
};
