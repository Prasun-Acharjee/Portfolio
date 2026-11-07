// Shared Diwali counters: diyas lit, fireworks launched, rangolis drawn, across every visitor.
// Backed by Upstash Redis (Vercel Marketplace). Reads either the Vercel KV-style or the Upstash env var names.
//   GET  /api/diwali-counts            -> { diyas, fireworks, rangolis }
//   POST /api/diwali-counts {diyas:2}  -> increments, returns the new totals
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FIELDS = ['diyas', 'fireworks', 'rangolis'];
const MAX_PER_POST = 40; // one visitor's batch every few seconds; caps casual abuse

const key = () => `diwali:${new Date().getUTCFullYear()}`;

async function redis(commands) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return r.json();
}

const totals = (vals) => Object.fromEntries(FIELDS.map((f, i) => [f, Number(vals[i]) || 0]));

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (!URL_ || !TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'counter store not connected' })); }
  try {
    const k = key();
    if (req.method === 'POST') {
      const body = readBody(req);
      const cmds = [];
      for (const f of FIELDS) {
        const n = Math.floor(Number(body[f]) || 0);
        if (n > 0) cmds.push(['HINCRBY', k, f, Math.min(n, MAX_PER_POST)]);
      }
      cmds.push(['HMGET', k, ...FIELDS]);
      const out = await redis(cmds);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify(totals(out[out.length - 1].result)));
    }
    if (req.method === 'GET') {
      const out = await redis([['HMGET', k, ...FIELDS]]);
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.end(JSON.stringify(totals(out[0].result)));
    }
    res.statusCode = 405; res.setHeader('Allow', 'GET, POST'); res.end('{}');
  } catch (e) {
    res.statusCode = 502; res.end(JSON.stringify({ error: 'counter store unavailable' }));
  }
};
