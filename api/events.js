// LadyDawgs schedule API  (backed by Vercel KV / Upstash Redis)
//
//   GET  /api/events
//     -> public, read-only. Returns every event ordered for display.
//        If the KV store has no data yet, returns the two default events.
//
//   POST /api/events
//     -> admin only. Body must include the correct { password }.
//        The password is compared against the ADMIN_PASSWORD env var
//        server-side and is never shipped to the browser.
//        Supported actions (field "action"):
//          create  : { password, action:"create", event:{...} }
//          update  : { password, action:"update", id, event:{...} }
//          delete  : { password, action:"delete", id }
//          reorder : { password, action:"reorder", order:[id1, id2, ...] }
//
// The whole schedule lives in one KV key ("ladydawgs:events") as a JSON
// array of event objects. All connection details and the admin password are
// read from environment variables. Nothing is hardcoded.

const {
  kv,
  getEvents,
  readActive,
  saveEvents,
  passwordOk,
  readJsonBody,
  publicShape,
  newId,
} = require('./_kv');

// Whitelist of fields a write is allowed to set, with light coercion.
function cleanEvent(input = {}) {
  const out = {};
  if (input.day_label   !== undefined) out.day_label   = String(input.day_label   ?? '');
  if (input.title       !== undefined) out.title       = String(input.title       ?? '');
  if (input.details     !== undefined) out.details     = String(input.details     ?? '');
  if (input.time_text   !== undefined) out.time_text   = String(input.time_text   ?? '');
  if (input.event_date  !== undefined) {
    const v = input.event_date;
    out.event_date = (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
  }
  if (input.link_url    !== undefined) out.link_url    = input.link_url ? String(input.link_url) : null;
  if (input.link_label  !== undefined) out.link_label  = input.link_label ? String(input.link_label) : null;
  if (input.is_standing !== undefined) out.is_standing = Boolean(input.is_standing);
  if (input.position    !== undefined && input.position !== null && input.position !== '') {
    const n = Number(input.position);
    if (Number.isFinite(n)) out.position = Math.trunc(n);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    // ---------- READ ----------
    if (req.method === 'GET') {
      const redis = kv();
      const events = await getEvents(redis);
      // Public reads may be cached briefly at the edge.
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
      res.status(200).json({ events: events.map(publicShape) });
      return;
    }

    // ---------- WRITE ----------
    if (req.method === 'POST') {
      const body = await readJsonBody(req);

      if (!passwordOk(body.password)) {
        res.status(401).json({ error: 'Incorrect password.' });
        return;
      }

      const action = body.action;
      const redis = kv();
      // Read the current list (seeds from defaults if the key is missing) and
      // prune any events that are already past before applying the change.
      let events = await readActive(redis);

      if (action === 'create') {
        const row = cleanEvent(body.event);
        if (row.position === undefined) {
          const maxPos = events.reduce((m, e) => Math.max(m, Number(e.position) || 0), -1);
          row.position = maxPos + 1;
        }
        const created = Object.assign(
          { id: newId(), day_label: '', title: '', details: '', time_text: '',
            event_date: null, link_url: null, link_label: null, is_standing: false },
          row
        );
        events.push(created);
        await saveEvents(redis, events);
        res.status(201).json({ event: publicShape(created) });
        return;
      }

      if (action === 'update') {
        if (!body.id) { res.status(400).json({ error: 'Missing id.' }); return; }
        const idx = events.findIndex(e => e.id === body.id);
        if (idx === -1) { res.status(404).json({ error: 'Event not found.' }); return; }
        events[idx] = Object.assign({}, events[idx], cleanEvent(body.event));
        await saveEvents(redis, events);
        res.status(200).json({ event: publicShape(events[idx]) });
        return;
      }

      if (action === 'delete') {
        if (!body.id) { res.status(400).json({ error: 'Missing id.' }); return; }
        events = events.filter(e => e.id !== body.id);
        await saveEvents(redis, events);
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'reorder') {
        const order = Array.isArray(body.order) ? body.order : [];
        if (!order.length) { res.status(400).json({ error: 'Missing order array.' }); return; }
        const rank = new Map(order.map((id, i) => [id, i]));
        // Set position from the incoming order; anything not listed goes to the end.
        events.forEach(e => {
          e.position = rank.has(e.id) ? rank.get(e.id) : order.length + 1;
        });
        await saveEvents(redis, events);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Unknown action.' });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    // Log full detail server-side; return a generic message to the client.
    console.error('[api/events]', err);
    res.status(500).json({ error: 'Server error. Check the function logs.' });
  }
};
