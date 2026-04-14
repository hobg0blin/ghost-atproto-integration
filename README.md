# Ghost → ATProto Integration

Syncs Ghost blog posts to your self-hosted ATProto PDS as `site.standard.document` records,
making them discoverable on leaflet.pub, pckt, Standard Search, and other ATProto clients.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Ghost URL, Content API key, PDS credentials, and webhook secret
```

To get a Ghost Content API key: **Ghost Admin → Settings → Integrations → Add custom integration → API keys → Content API key**.
To get an ATProto app password: your PDS settings panel.

### 3. Create publication record (once)
```bash
npm run setup
```
This creates your `site.standard.publication` record on your PDS.
It will print your DID — add it as `ATP_DID=...` in your `.env`.
You can also edit `setup.js` to set your blog's title and description before running.

### 4. Backfill existing posts (once)
```bash
npm run backfill
```
Fetches all published Ghost posts and publishes them to your PDS. Safe to re-run.

### 5. Start the webhook server
```bash
npm start
```

### 6. Configure Ghost webhook
**Ghost Admin → Settings → Integrations → Add custom integration → Add webhook**
- Events: `Post published`, `Post updated`, `Post unpublished`
- Target URL: `http://localhost:3456/webhook` (adjust if the server runs elsewhere)
- Secret: same value as `GHOST_WEBHOOK_SECRET` in your `.env`

### 7. Install as a systemd service (optional but recommended)
```bash
# Edit ghost-atproto.service — set User and WorkingDirectory to match your setup
sudo cp ghost-atproto.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ghost-atproto
```

## Viewing your posts

Once records are published, they'll appear on:
- **leaflet.pub** — search for your handle or DID
- **pckt.blog** — same
- **Standard Search** — https://search.standard.site (or similar)
