/**
 * One-time setup: creates the site.standard.publication record on your PDS.
 * Run once before backfill or deploying the webhook server.
 *
 * Usage: node setup.js
 */

import 'dotenv/config';
import { createAgent, publicationUri, putPublication } from './lib/atproto.js';

const { ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD, GHOST_URL } = process.env;

if (!ATP_PDS_URL || !ATP_HANDLE || !ATP_APP_PASSWORD || !GHOST_URL) {
  console.error('Missing required env vars. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

console.log(`Connecting to PDS: ${ATP_PDS_URL}`);
const agent = await createAgent(ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD);
console.log(`Logged in as ${agent.session.did}`);

const uri = await putPublication(agent, {
  url: GHOST_URL,
  // Edit these to match your blog:
  title: 'My Blog',
  description: 'Posts from my Ghost blog',
});

console.log(`\nPublication record created: ${uri}`);
console.log(`Publication URI: ${publicationUri(agent.session.did)}`);
console.log('\nAdd this to your .env:');
console.log(`ATP_DID=${agent.session.did}`);
