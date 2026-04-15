/**
 * One-time setup: creates the site.standard.publication record on your PDS.
 * Run once before backfill or deploying the webhook server.
 *
 * Usage: node setup.js
 */

import 'dotenv/config';
import { createAgent, publicationUri, putPublication } from './lib/atproto.js';

const { ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD, GHOST_URL, GHOST_CONTENT_API_KEY } = process.env;

if (!ATP_PDS_URL || !ATP_HANDLE || !ATP_APP_PASSWORD || !GHOST_URL || !GHOST_CONTENT_API_KEY) {
  console.error('Missing required env vars. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// Fetch blog title and description from Ghost
console.log(`Fetching site info from ${GHOST_URL}...`);
const settingsUrl = new URL('/ghost/api/content/settings/', GHOST_URL);
settingsUrl.searchParams.set('key', GHOST_CONTENT_API_KEY);
const res = await fetch(settingsUrl);
if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${res.statusText}`);
const { settings } = await res.json();
console.log(`Blog: "${settings.title}" — ${settings.description || '(no description)'}`);

console.log(`\nConnecting to PDS: ${ATP_PDS_URL}`);
const agent = await createAgent(ATP_PDS_URL, ATP_HANDLE, ATP_APP_PASSWORD);
console.log(`Logged in as ${agent.session.did}`);

const uri = await putPublication(agent, {
  url: GHOST_URL,
  name: settings.title,
  ...(settings.description && { description: settings.description }),
});

const pubAtUri = publicationUri(agent.session.did);
console.log(`\nPublication record created: ${uri}`);
console.log(`Publication URI: ${pubAtUri}`);
console.log('\nAdd this to your .env:');
console.log(`ATP_DID=${agent.session.did}`);

console.log('\n--- Verification Setup ---');
console.log(`Add this to your Nginx server block for ${GHOST_URL}:\n`);
console.log(`  location = /.well-known/site.standard.publication {`);
console.log(`      default_type text/plain;`);
console.log(`      return 200 '${pubAtUri}';`);
console.log(`  }\n`);
console.log('Then reload Nginx: sudo nginx -t && sudo systemctl reload nginx');
