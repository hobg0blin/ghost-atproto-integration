/**
 * Webhook server — listens for Ghost post events and syncs to ATProto PDS.
 * Handles: post.published, post.updated, post.unpublished
 *
 * Usage: node server.js  (or via systemd)
 */

import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { createAgent, publicationUri, putDocument, deleteDocument } from './lib/atproto.js';
import { buildDocumentRecord } from './lib/convert.js';
import { injectDocumentLink, removeDocumentLink } from './lib/ghost-admin.js';

const {
  ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD, ATP_DID,
  GHOST_URL, GHOST_ADMIN_API_KEY, GHOST_WEBHOOK_SECRET,
  PORT = '3456',
} = process.env;

if (!ATP_PDS_URL || !ATP_HANDLE || !ATP_APP_PASSWORD || !GHOST_WEBHOOK_SECRET) {
  console.error('Missing required env vars. Check your .env file.');
  process.exit(1);
}

// Authenticate once at startup; the session auto-refreshes via the SDK
const agent = await createAgent(ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD);
const did = ATP_DID || agent.session.did;
const pubUri = publicationUri(did);
console.log(`Connected to PDS as ${did}`);

function validateSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  // Ghost sends: "sha256=<hex>, t=<timestamp>"
  // Ghost signs: timestamp + rawBody (concatenated as strings)
  const sigMatch = signatureHeader.match(/sha256=([a-f0-9]+)/);
  const tsMatch = signatureHeader.match(/t=(\d+)/);
  if (!sigMatch || !tsMatch) return false;

  const expected = crypto
    .createHmac('sha256', GHOST_WEBHOOK_SECRET)
    .update(rawBody.toString() + tsMatch[1])
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(sigMatch[1], 'hex'), Buffer.from(expected, 'hex'));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleWebhook(event, post) {
  const slug = post.slug;

  if (event === 'post.unpublished') {
    await deleteDocument(agent, slug);
    if (GHOST_ADMIN_API_KEY && post.id) {
      await removeDocumentLink(GHOST_URL, GHOST_ADMIN_API_KEY, post.id);
    }
    console.log(`Deleted: ${slug}`);
    return;
  }

  // post.published or post.updated
  const record = buildDocumentRecord(post, pubUri);
  const uri = await putDocument(agent, slug, record);
  console.log(`${event === 'post.published' ? 'Published' : 'Updated'}: ${slug} → ${uri}`);

  // Inject <link> verification tag into the Ghost post
  if (GHOST_ADMIN_API_KEY && post.id) {
    await injectDocumentLink(GHOST_URL, GHOST_ADMIN_API_KEY, post.id, uri);
    console.log(`Injected document link into: ${slug}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || (req.url !== '/' && req.url !== '/webhook')) {
    res.writeHead(404).end();
    return;
  }

  const rawBody = await readBody(req);

  if (!validateSignature(rawBody, req.headers['x-ghost-signature'])) {
    console.warn('Rejected request: invalid signature');
    res.writeHead(401).end('Unauthorized');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const post = payload?.post?.current;
  const previous = payload?.post?.previous;

  if (!post?.slug) {
    res.writeHead(200).end('Ignored');
    return;
  }

  // Infer event from status transitions
  let event;
  if (post.status === 'published' && previous?.status !== 'published') {
    event = 'post.published';
  } else if (post.status === 'published' && previous?.status === 'published') {
    event = 'post.updated';
  } else if (post.status !== 'published' && previous?.status === 'published') {
    event = 'post.unpublished';
  } else {
    res.writeHead(200).end('Ignored');
    return;
  }

  console.log(`${event}: ${post.slug}`);

  // Respond immediately so Ghost doesn't time out, then process async
  res.writeHead(200).end('OK');

  try {
    await handleWebhook(event, post);
  } catch (err) {
    console.error(`Error handling ${event} for ${post.slug}: ${err.message}`);
  }
});

server.listen(parseInt(PORT), () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
