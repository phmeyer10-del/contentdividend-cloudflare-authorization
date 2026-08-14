# ContentDividend Cloudflare Authorization Bridge

This is the **public deployment template** for ContentDividend publishers who use Cloudflare.

## What it does

For AI-looking requests, the Worker asks ContentDividend whether the request has a valid licensed-content credential for the exact publisher-authorized URL.

A bot name or User-Agent is **not** proof of permission.

## Before deploying

1. Create a ContentDividend publisher account.
2. Add your website.
3. Open `https://app.contentdividend.com/dashboard/cloudflare-authorization`.
4. Create the bridge in **Observe Only** mode.
5. Copy the Site ID, Bridge ID, and one-time private Bridge Secret.

## Deploy to Cloudflare

Use the Deploy to Cloudflare button after this repository is published on GitHub or GitLab.

Cloudflare requires a public GitHub/GitLab repository for public Deploy to Cloudflare buttons.

## Required values

- `CONTENTDIVIDEND_SITE_ID` — publisher Site ID from ContentDividend.
- `CONTENTDIVIDEND_BRIDGE_ID` — bridge ID from ContentDividend.
- `CONTENTDIVIDEND_BRIDGE_SECRET` — private one-time bridge secret. Store as a Cloudflare secret.
- `CONTENTDIVIDEND_API_BASE` — defaults to `https://app.contentdividend.com`.

## Safe default

New ContentDividend bridges start in **Observe Only**. Test first. The publisher explicitly decides whether to enable AI enforcement.

## Rights boundary

Installing this Worker does not create a license, grant rights, or expand an existing license. ContentDividend checks existing license and exact publisher-authorized content-access state.
