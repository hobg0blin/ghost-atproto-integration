/**
 * One-time backfill: publishes all existing Ghost posts to your ATProto PDS.
 * Safe to re-run — uses slug as rkey so existing records are overwritten, not duplicated.
 *
 * Usage: node backfill.js
 */

import 'dotenv/config';
import { createAgent, publicationUri, putDocument } from './lib/atproto.js';
import { buildDocumentRecord } from './lib/convert.js';

const {
  ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD, ATP_DID,
  GHOST_URL, GHOST_CONTENT_API_KEY,
} = process.env;

if (!ATP_PDS_URL || !ATP_HANDLE || !ATP_APP_PASSWORD || !GHOST_URL || !GHOST_CONTENT_API_KEY) {
  console.error('Missing required env vars. Make sure .env is configured and setup.js has been run.');
  process.exit(1);
}

async function fetchAllPosts() {
  const allPosts = [];
  let page = 1;

  while (true) {
    const url = new URL('/ghost/api/content/posts/', GHOST_URL);
    url.searchParams.set('key', GHOST_CONTENT_API_KEY);
    url.searchParams.set('include', 'tags');
    url.searchParams.set('formats', 'html');
    url.searchParams.set('limit', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('order', 'published_at asc');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${res.statusText}`);
    const { posts, meta } = await res.json();
    allPosts.push(...posts);

    if (!meta?.pagination?.next) break;
    page++;
  }

  return allPosts;
}

console.log('Fetching all published Ghost posts...');
const posts = await fetchAllPosts();
console.log(`Found ${posts.length} posts.`);

console.log(`\nConnecting to PDS: ${ATP_PDS_URL}`);
const agent = await createAgent(ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD);
const did = ATP_DID || agent.session.did;
const pubUri = publicationUri(did);
console.log(`Publishing as ${did}\n`);

let success = 0;
let failed = 0;

for (const post of posts) {
  try {
    const record = buildDocumentRecord(post, pubUri);
    const uri = await putDocument(agent, post.slug, record);
    console.log(`✓ ${post.slug} → ${uri}`);
    success++;
  } catch (err) {
    console.error(`✗ ${post.slug}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${success} published, ${failed} failed.`);
