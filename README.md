I wanted to keep my self-hosted Ghost installation while being able to sync my posts to atproto, so I built this. Feel free to make PRs/reach out to me with issues or questions but this is a hobby project I spent roughly three hours on and I make no maintenance promises.

# Ghost-ATProto Integration

A small service that syncs Ghost blog posts to your PDS as `site.standard.document` records,
making them discoverable on leaflet.pub and other ATProto clients that support the
[standard.site](https://standard.site) lexicons.

## Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

You'll need to create a custom integration:
-  Ghost Admin → Settings → Integrations → Add custom integration 

This should provide you with a content API and admin API key for your environment. Make a local secret to add to your webhooks. 

### 3. Configure Ghost webhook
**Ghost Admin → Settings → Integrations → your integration → Add webhook**
- Events: `Post published`, `Post updated`, `Post unpublished`
- Target URL: `http://localhost:3456` (or wherever the server runs)
- Secret: same value as `GHOST_WEBHOOK_SECRET` in your `.env`



### 4. Create publication record (once)
```bash
pnpm run setup
```
Creates your `site.standard.publication` record on your PDS, pulling the blog title and
description from Ghost automatically. Also prints your DID and a `location = ` block to put in your nginx config .

### 5. Verify your publication

Add a `.well-known` route to your Nginx config so standard.site clients can verify ownership.
`setup.js` prints the exact config block, but it looks like:

```nginx
location = /.well-known/site.standard.publication {
    default_type text/plain;
    return 200 'at://did:plc:YOUR_DID/site.standard.publication/self';
}
```
Your nginx config should be at `/etc/nginx/sites-enabled/{YOUR_DOMAIN}.conf`.

Add the block, then reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Verify at `https:/{YOUR_URL}/.well-known/site.standard.publication`.

### 6. Backfill existing posts (once)
```bash
pnpm run backfill
```
Fetches all published Ghost posts (paginated, Ghost 6 compatible) and publishes them to your
PDS. Safe to re-run — uses slug as rkey, so duplicates just overwrite.

### 7. Start the webhook server
```bash
npm start
```

### 8. Install as a systemd service (optional but recommended)
```bash
# Edit ghost-atproto.service — set User and WorkingDirectory to match your setup
sudo cp ghost-atproto.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ghost-atproto
```

## Viewing your posts

Once published and verified, your posts should appear on standard.site-compatible readers - I recommend using [standard search](https://site-validator.fly.dev/) and [standard.site validator](https://site-validator.fly.dev/) to make sure everything's working properly.
