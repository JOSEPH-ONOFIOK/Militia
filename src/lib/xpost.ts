// Reads a public X post through X's public embed data (the same source X's embeds use).
// No X API key needed, but it only sees public posts.

const POST_LINK = /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status(?:es)?\/(\d+)/i;

type PublicPost = { author: string; text: string; replyTo?: string };

// The embed endpoint expects a token derived from the post id
const tokenFor = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

async function fetchPost(id: string): Promise<PublicPost | null> {
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${tokenFor(id)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j?.user?.screen_name || typeof j.text !== "string") return null; // deleted, private or withheld
  return { author: String(j.user.screen_name), text: j.text, replyTo: j.in_reply_to_status_id_str ?? undefined };
}

// Checks that `link` is a public reply by `handle`, directly under the approval post, containing the word
export async function verifyReply(
  link: string,
  handle: string,
  postId: string,
  word: string,
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const m = POST_LINK.exec(link.trim());
  if (!m) return { ok: false, error: "Paste the link to your reply. It looks like x.com/you/status/123…" };
  let post: PublicPost | null;
  try {
    post = await fetchPost(m[2]);
  } catch {
    return { ok: false, error: "We couldn't reach X just now. Try again in a minute." };
  }
  if (!post) return { ok: false, error: "We couldn't find that post. Make sure your account is public and the link is right." };
  if (post.author.toLowerCase() !== handle.toLowerCase()) {
    return { ok: false, error: `That reply is from @${post.author}. Reply from your own account, @${handle}.` };
  }
  if (post.replyTo !== postId) return { ok: false, error: "That isn't a reply to our post. Reply directly under it." };
  if (!post.text.toLowerCase().includes(word.toLowerCase())) return { ok: false, error: `Your reply needs to say ${word}.` };
  return { ok: true, link: `https://x.com/${post.author}/status/${m[2]}` };
}
