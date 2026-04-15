import crypto from 'crypto';

/**
 * Ghost Admin API JWT auth — no external deps.
 * Admin API key format: "id:secret" (hex-encoded secret)
 */
function makeToken(adminApiKey) {
  const [id, secret] = adminApiKey.split(':');
  const key = Buffer.from(secret, 'hex');

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/',
  })).toString('base64url');

  const sig = crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/**
 * Inject a <link rel="site.standard.document"> tag into a Ghost post's head.
 * Preserves any existing code injection content.
 */
export async function injectDocumentLink(ghostUrl, adminApiKey, postId, atUri) {
  const token = makeToken(adminApiKey);
  const linkTag = `<link rel="site.standard.document" href="${atUri}" />`;

  // Fetch current post to preserve existing code injection
  const getRes = await fetch(`${ghostUrl}/ghost/api/admin/posts/${postId}/`, {
    headers: { Authorization: `Ghost ${token}` },
  });
  if (!getRes.ok) throw new Error(`Ghost Admin API GET failed: ${getRes.status}`);
  const { posts } = await getRes.json();
  const post = posts[0];

  // Check if link tag already exists
  const existing = post.codeinjection_head || '';
  if (existing.includes('rel="site.standard.document"')) {
    // Replace existing tag
    const updated = existing.replace(/<link\s+rel="site\.standard\.document"[^>]*\/>/, linkTag);
    if (updated === existing) return; // identical, nothing to do
    var newHead = updated;
  } else {
    var newHead = existing ? `${existing}\n${linkTag}` : linkTag;
  }

  // Update the post — Ghost requires updated_at for conflict resolution
  const putRes = await fetch(`${ghostUrl}/ghost/api/admin/posts/${postId}/`, {
    method: 'PUT',
    headers: {
      Authorization: `Ghost ${makeToken(adminApiKey)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      posts: [{ codeinjection_head: newHead, updated_at: post.updated_at }],
    }),
  });
  if (!putRes.ok) throw new Error(`Ghost Admin API PUT failed: ${putRes.status}`);
}

/**
 * Remove the site.standard.document link tag from a post's code injection.
 */
export async function removeDocumentLink(ghostUrl, adminApiKey, postId) {
  const token = makeToken(adminApiKey);

  const getRes = await fetch(`${ghostUrl}/ghost/api/admin/posts/${postId}/`, {
    headers: { Authorization: `Ghost ${token}` },
  });
  if (!getRes.ok) throw new Error(`Ghost Admin API GET failed: ${getRes.status}`);
  const { posts } = await getRes.json();
  const post = posts[0];

  const existing = post.codeinjection_head || '';
  if (!existing.includes('rel="site.standard.document"')) return;

  const newHead = existing.replace(/<link\s+rel="site\.standard\.document"[^>]*\/>\n?/, '').trim();

  const putRes = await fetch(`${ghostUrl}/ghost/api/admin/posts/${postId}/`, {
    method: 'PUT',
    headers: {
      Authorization: `Ghost ${makeToken(adminApiKey)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      posts: [{ codeinjection_head: newHead || null, updated_at: post.updated_at }],
    }),
  });
  if (!putRes.ok) throw new Error(`Ghost Admin API PUT failed: ${putRes.status}`);
}
