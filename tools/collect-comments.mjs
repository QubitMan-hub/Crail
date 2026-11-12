// Snapshots the comments on one of your own Reels through Instagram's official API,
// ranks them by likes, and writes a public ledger file. Read-only: it never posts,
// hides or deletes anything.
//
//   IG_TOKEN=... npm run votes -- --list                      -> your recent posts and their ids
//   IG_TOKEN=... npm run votes -- --day 1 --reel <permalink>  -> ledger/day-001.json
//   IG_TOKEN=... npm run votes -- --refresh                   -> prints a renewed 60-day token
//
// Needs a long-lived token for a Professional (Creator/Business) account with the
// instagram_business_basic and instagram_business_manage_comments permissions.
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const API = 'https://graph.instagram.com/v27.0';
const COMMENT_FIELDS = 'id,text,username,like_count,timestamp,hidden';

/** Rank comments: most likes first; ties go to whoever commented earliest. */
export function rankComments(comments, { owner, deadline } = {}) {
  const cutoff = deadline ? new Date(deadline).getTime() : Infinity;
  return comments
    .filter((c) => !c.hidden)
    .filter((c) => !owner || c.username !== owner)
    .filter((c) => new Date(c.timestamp).getTime() <= cutoff)
    .map((c) => ({
      id: c.id,
      username: c.username ?? '(unavailable)',
      text: c.text ?? '',
      likes: c.like_count ?? 0,
      timestamp: c.timestamp,
    }))
    .sort((a, b) => b.likes - a.likes || new Date(a.timestamp) - new Date(b.timestamp))
    .map((c, i) => ({ rank: i + 1, ...c }));
}

/** Shortcode from a permalink such as https://www.instagram.com/reel/Cabc123/ */
export function shortcodeOf(reel) {
  const m = /instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(reel);
  return m ? m[1] : null;
}

async function get(url, token) {
  const u = new URL(url);
  if (!u.searchParams.has('access_token')) u.searchParams.set('access_token', token);
  const res = await fetch(u);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never echo the URL: it contains the token.
    throw new Error(`Instagram API ${res.status}: ${body?.error?.message ?? 'request failed'}`);
  }
  return body;
}

async function getAll(url, token, limit = Infinity) {
  const items = [];
  for (let next = url; next && items.length < limit; ) {
    const page = await get(next, token);
    items.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }
  return items;
}

async function findMedia(reel, me, token) {
  if (/^\d+$/.test(reel)) {
    return get(`${API}/${reel}?fields=id,permalink,timestamp,comments_count`, token);
  }
  const code = shortcodeOf(reel);
  if (!code) throw new Error(`Could not read a Reel link or media id from "${reel}".`);
  const media = await getAll(
    `${API}/${me.user_id}/media?fields=id,permalink,shortcode,timestamp,comments_count&limit=50`,
    token,
    500,
  );
  const hit = media.find((m) => m.shortcode === code || shortcodeOf(m.permalink ?? '') === code);
  if (!hit) throw new Error(`No post with shortcode ${code} found on @${me.username}.`);
  return hit;
}

async function main() {
  const { values } = parseArgs({
    options: {
      list: { type: 'boolean', default: false },
      refresh: { type: 'boolean', default: false },
      day: { type: 'string' },
      reel: { type: 'string' },
      hours: { type: 'string', default: '24' },
      top: { type: 'string', default: '25' },
      out: { type: 'string', default: 'ledger' },
    },
  });
  const token = process.env.IG_TOKEN;
  if (!token) throw new Error('Set IG_TOKEN to your long-lived Instagram access token.');

  if (values.refresh) {
    const r = await get(
      'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token',
      token,
    );
    console.log(JSON.stringify({ access_token: r.access_token, expires_in_days: Math.round(r.expires_in / 86400) }));
    return;
  }

  const me = await get(`${API}/me?fields=user_id,username`, token);

  if (values.list) {
    const media = await getAll(
      `${API}/${me.user_id}/media?fields=id,permalink,timestamp,comments_count&limit=20`,
      token,
      20,
    );
    for (const m of media) console.log(`${m.timestamp}  ${m.id}  ${m.comments_count} comments  ${m.permalink}`);
    return;
  }

  if (!values.day || !/^\d+$/.test(values.day) || !values.reel) {
    throw new Error('Usage: npm run votes -- --day <number> --reel <permalink or media id>');
  }

  const media = await findMedia(values.reel, me, token);
  const posted = new Date(media.timestamp.replace(/\+0000$/, 'Z'));
  const deadline = new Date(posted.getTime() + Number(values.hours) * 3600_000);
  const now = new Date();

  const raw = await getAll(`${API}/${media.id}/comments?fields=${COMMENT_FIELDS}&limit=50`, token);
  const ranked = rankComments(raw, { owner: me.username, deadline });

  const ledger = {
    day: Number(values.day),
    method: 'top-comment',
    reel: media.permalink,
    posted_at: posted.toISOString(),
    voting_closed_at: deadline.toISOString(),
    snapshot_at: now.toISOString(),
    // Like counts are read at snapshot time. A snapshot taken before the deadline is provisional.
    final: now >= deadline,
    eligible_comments: ranked.length,
    leader: ranked[0] ?? null,
    // Filled in by hand once the result is confirmed: see RULES.md.
    winner: null,
    decision_note: '',
    ranking: ranked.slice(0, Number(values.top)),
  };

  await mkdir(values.out, { recursive: true });
  const file = `${values.out}/day-${String(values.day).padStart(3, '0')}.json`;
  await writeFile(file, JSON.stringify(ledger, null, 2) + '\n');
  console.log(`Wrote ${file}: ${ranked.length} eligible comments.`);
  if (ranked[0]) console.log(`Leader: @${ranked[0].username} (${ranked[0].likes} likes): ${ranked[0].text}`);
  if (!ledger.final) console.log('Voting is still open: this snapshot is provisional.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
