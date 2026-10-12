# NEXT MOVE — Your First 30 Days, Simplified.
Udbhav AI Sprint, Problem Statement 2. Plain website (no PWA): HTML/CSS/vanilla JS + Node/Express.

## Run
    npm install
    npm start
Open http://localhost:3000. Works with no API key (demo assistant).

## Optional AI
    cp .env.example .env   # then set OPENAI_API_KEY (server-side only; .env is git-ignored)
Works with any OpenAI-compatible endpoint via OPENAI_BASE_URL / OPENAI_MODEL. The key never reaches the browser.

## Deploy (Render)
1. Push to GitHub (do not commit .env). 2. Render → New Web Service → pick repo.
3. Build: `npm install`; Start: `npm start`. 4. Add env vars (OPENAI_API_KEY optional). Static-only hosting will not run the backend.

## API
GET /api/health · GET /api/services · POST /api/plan · POST /api/chat (10 req/min/IP)

## Data
All services in data/services.json are fictional demo records. Do not add real ones without sources and verification.

## Dashboards
- `/customer.html` — progress, budget vs plan, next tasks, services in your locality (reads your browser's saved data).
- `/provider.html` — providers add/delete listings. New listings are saved to `data/listings.json` as **provider-listed, unverified**. A random edit key is shown to the browser only once (kept in localStorage); only its hash is stored.

## Adding real data
1. **Provider self-listing:** providers use `/provider.html`. Contact info they enter is public. Listings appear in the directory labelled "Provider-listed, unverified".
2. **Verification (only after you genuinely check):** set `ADMIN_TOKEN` in `.env`, then:
   `curl -X POST http://localhost:3000/api/admin/verify -H "Content-Type: application/json" -H "x-admin-token: YOUR_TOKEN" -d '{"id":"p_xxxx","source":"How you confirmed it","lastConfirmed":"2026-10-12"}'`
   This marks it "Verified" with your source and date. Do this only for checks you actually performed.
3. **Bulk import:** add objects to `data/listings.json` (fields: id, name, category, locality, priceMin, priceMax, description, contact, source, verification = "provider-listed" or "verified", lastConfirmed, keyHash). Use real, sourced data only; remove demo records from `data/services.json` once you have real ones.
4. **Accommodation comparison** needs rent/deposit/brokerage fields; the provider form does not collect them yet, so only demo records appear there. Add those fields before listing real accommodation.

## Limitations
- Provider identity is not verified and there is no login: whoever holds the edit key controls a listing. Add real authentication before public launch.
- `data/listings.json` is a file: on Render's free tier the disk resets on redeploy. Attach a persistent disk or move to a database for real use.
- No spam/abuse moderation beyond a 5-submission-per-minute limit and size checks.

## More features
- **Transport:** `#transport` on the home page gives general commute guidance (no fares listed, since none are verified) and a commute-cost calculator that can feed your budget.
- **Roommates:** `/roommates.html` — search by locality, type and budget; post with a display name only; send a request. Requester contact is visible only to the post owner via their edit key. Data is in `data/roommates.json`. No accounts or moderation yet.
- **Contact:** the form saves messages to `data/messages.json` (read it on the server). Set `CONTACT_EMAIL` to show a public email; otherwise the site shows demo details (`hello@nextmove.example`, `+91 90000 00000`) labelled as demo; set `CONTACT_PHONE` too.
- **Profile / Settings:** `/profile.html` edits saved preferences and refreshes your plan; `/settings.html` offers larger text, data export, resets and delete-all. Data stays in the browser.
- **Localities:** the list lives in `server.js` (`LOCALITIES`) and feeds every locality input.

## Plans, admin, and persistence
- **Plans:** Free ₹0, Normal ₹199/month, Premium ₹499/month (`#plans`). No payment gateway is integrated: selecting a plan charges nothing. The only plan effects are post/listing limits (Free 1/2, Normal 3/5, Premium 10/20 roommate posts/provider listings), enforced **in the browser only** (demo). Real enforcement needs accounts plus a payment provider such as Razorpay.
- **Admin:** set `ADMIN_TOKEN` in `.env`, open `/admin.html`, sign in. Verify or delete listings, delete roommate posts, dismiss reports, read contact messages. The page isn't linked publicly; requests are rate-limited and the token is compared in constant time. Use HTTPS in production.
- **Verifiable info:** a listing becomes "Verified" only when an admin records how and when they confirmed it. Cards show source and date, warn when older than 90 days, and have "Report incorrect info" (queued for the admin). There is also a "Verified only" filter.
- **Persistence:** set `DATA_DIR` to a persistent disk path (e.g. a Render disk mount) so listings, posts, messages and reports survive redeploys. Writes are atomic (temp file + rename).
- **App-like, not a PWA:** the UI has a mobile bottom tab bar and smooth transitions, but there is deliberately no manifest or service worker.

## Still not done
No user accounts or logins (edit keys only), no real payments, no automated moderation, JSON files instead of a database.

## Review fixes (2026-10-12)
- `trust proxy` enabled so per-IP rate limits work behind Render's proxy.
- `/api/admin/verify` now uses the same constant-time, rate-limited admin check and rejects impossible dates.
- Rate-limit maps are pruned periodically (no unbounded memory growth).
- Roommate locality filter is case-insensitive; oversized bodies return a clear 413 message.

## Design and guide data
- New look: warm paper palette, saffron + teal accents, serif headings, sticker-style buttons (all in `public/styles.css`).
- `data/guide.json` is original editorial content (locality orientation, first-week tips, landmarks) served at `GET /api/guide`. It has no prices or businesses; edit it freely. It is general knowledge, not verified listings, so review it before public launch.

## Rename and demo contacts
- Product renamed to **NEXT MOVE** everywhere (UI, titles, README, package name).
- Every demo service now has a clearly fake contact (`+91 90000 000NN`, `demoN@example.com`). Replace with real, verified details before launch.
