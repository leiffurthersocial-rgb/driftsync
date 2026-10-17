# Connecting Supabase: accounts and sync

This guide takes Driftsync from "saved on this device" to "signed in and synced across your devices". The app side is finished; all that's left is configuration in Supabase and Vercel. Allow about 20 minutes, plus 10 if you add Google or GitHub sign-in.

**What you get**

- Optional accounts. Without signing in, Driftsync works exactly as before.
- Sign-in by **email link** (no passwords), and optionally Google, GitHub and others.
- Everything (plans, repeats, sleep lines, to-dos, goals, templates, activities, settings) syncs between your devices. It's saved on the device first, so the app stays instant and works offline; changes upload in the background and arrive on your other devices within seconds.
- Conflicts are resolved per item: when the same thing was changed in two places, the newest edit wins. Deletions sync too.

**Where you are:** you created a Supabase project and ran the first version of `supabase/schema.sql`. Start at step 1. It updates that schema in place and nothing you've done is lost.

---

## Part A: Supabase dashboard

### 1. Run the updated schema

The schema gained a few things the sync needs:

- a server timestamp (`synced_at`), so a device whose clock is off can't miss changes;
- the `driftsync_push` function, which only replaces something if the incoming copy is newer, so an offline device can't overwrite fresher edits;
- Realtime, for instant updates.

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Left sidebar → **SQL Editor** → **New query**.
3. Paste the **entire** contents of [`supabase/schema.sql`](../supabase/schema.sql) and press **Run**.
   - "Success. No rows returned" is the expected result.
   - It's safe to run as many times as you like. Run it again whenever this file changes in a future update.
4. Check it worked:
   - **Table Editor** lists `app_state` and `records`, both marked as having RLS enabled. They stay empty until you sign in.
   - **Database → Functions** lists `driftsync_push` (and `driftsync_touch`).
   - **Database → Publications → supabase_realtime** includes `records` and `app_state`. If they're missing, the app still syncs (on focus and every 2 minutes) instead of instantly.

> **Why this is safe to expose:** every row is tied to a user, and row-level security only lets a signed-in user read or write their own rows. The key you put in the app (next step) is designed to be public. **Never** put the `secret` / `service_role` key in the app or in a `NEXT_PUBLIC_` variable: it bypasses these protections.

### 2. Copy your project URL and publishable key

1. Click **Connect** at the top of the project (or open **Project Settings → API Keys**).
2. Copy:
   - the **Project URL**, like `https://abcdefghijklmnop.supabase.co`;
   - the **Publishable key**, which starts with `sb_publishable_`. Older projects show a legacy **anon** key (a long `eyJ…` string). It works too, but Supabase is retiring legacy keys by the end of 2026, so prefer the publishable key.
3. Keep these two values handy for Part B and Part C.

### 3. Tell Supabase where your site lives (redirect URLs)

Sign-in links and Google/GitHub must send people back to your site, and Supabase only allows addresses you list.

1. **Authentication → URL Configuration**.
2. **Site URL**: your production address, e.g. `https://driftsync.vercel.app` (no trailing slash).
3. **Redirect URLs** → **Add URL**, one per line:
   - `http://localhost:3000/auth/callback` for running the app on your computer;
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`, e.g. `https://driftsync.vercel.app/auth/callback`;
   - optionally, for Vercel preview deployments: `https://*-YOUR-VERCEL-ACCOUNT.vercel.app/**` (replace with your Vercel team or account slug).
4. **Save**.

### 4. Email sign-in (magic links)

Email sign-in is on by default (**Authentication → Sign In / Providers → Email**). Two limits of Supabase's built-in email sender matter:

- It **only sends to members of your Supabase organization**, so to your own Supabase login email, not to anyone else ("Email address not authorized").
- It sends at most **about 2 emails per hour**, and it's best-effort.

**Just you?** That's fine: sign in with the same email address you use for Supabase. Optionally, once you've signed in on all your devices, turn off **Allow new users to sign up** (Authentication → Sign In / Providers) so nobody else can create an account on your site.

**Other people too, or you keep hitting the limit?** Connect your own email sender (SMTP). With [Resend](https://resend.com) as an example (any SMTP provider works):

1. Create a Resend account, add and verify a domain you own (it gives you DNS records to add), and create an API key.
2. In Supabase: **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key;
   - Sender email: an address on your verified domain, e.g. `hello@yourdomain.com`; sender name `Driftsync`.
3. **Authentication → Rate Limits**: raise "emails sent per hour" if you need to. Custom SMTP starts at 30 per hour.

The default email template already contains the right link, and Driftsync's link-handling works with it unchanged.

### 5. Optional: Google, GitHub and other providers

Each provider needs an "OAuth app" on the provider's side and the matching ID and secret in Supabase. In every case the **callback URL** you give the provider is:

```
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
```

The project ref is the `abcdefghijklmnop` part of your Project URL. Supabase also shows this URL on each provider's settings panel.

**GitHub**

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL: your site. Authorization callback URL: the callback URL above.
3. Create, then **Generate a new client secret**.
4. Supabase → **Authentication → Sign In / Providers → GitHub**: enable it, paste the Client ID and Client Secret, Save.

**Google**

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → OAuth consent screen**: choose External, fill in the app name and your email, and add your domain under authorized domains.
3. **Credentials → Create credentials → OAuth client ID** → type *Web application*.
   - Authorized JavaScript origins: your site (and `http://localhost:3000`).
   - Authorized redirect URIs: the callback URL above.
4. Supabase → **Authentication → Sign In / Providers → Google**: enable it, paste the Client ID and Client Secret, Save.

**Show the buttons in the app:** set `NEXT_PUBLIC_SUPABASE_PROVIDERS` to a comma-separated list of what you enabled, e.g. `google,github`. Supported: `google`, `github`, `apple`, `azure` (Microsoft), `discord`, `gitlab`. Email links are always shown.

---

## Part B: Try it on your computer (optional but recommended)

1. In the project folder, copy `.env.example` to `.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
   # optional, only the providers you enabled in step 5:
   NEXT_PUBLIC_SUPABASE_PROVIDERS=github
   ```

2. `npm install`, then `npm run dev`, and open <http://localhost:3000>.
3. Go to **Settings → Account & sync** → **Sign in**, enter your email and press **Email me a sign-in link**.
4. Open the email **in the same browser** and click the link. You land back in Driftsync, signed in; a small cloud appears in the header.
5. In Supabase **Table Editor → records** you now see one row per item, and `app_state` holds your profile and settings.

`.env.local` is ignored by git, so your keys never end up in the repository.

---

## Part C: Turn it on for your live site (Vercel)

1. Vercel → your project → **Settings → Environment Variables**. Add these for **Production** (and **Preview** if you use previews):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key (or put the legacy key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
   | `NEXT_PUBLIC_SUPABASE_PROVIDERS` | optional, e.g. `google,github` |

2. **Redeploy**: Deployments → the latest one → ⋯ → **Redeploy**. `NEXT_PUBLIC_` values are baked in when the site is built, so adding them doesn't change a deployment that already exists.
3. Open the live site → **Settings → Account & sync**. It should now show **Sign in** instead of "Sync isn't set up".

---

## Part D: Using it

**First sign-in on each device.** Driftsync decides what to do automatically, and asks only when it has to:

| Situation | What happens |
| --- | --- |
| Your account is empty (your very first sign-in) | Everything on this device is uploaded. |
| This device is fresh (no plans, to-dos, goals, …) | It takes the account's data and skips onboarding. |
| Both have data | You're asked once: **Merge both** (keeps everything; where the same item was edited in both places, the newest edit wins; duplicate default activities like "Work" are combined) or **Use the account's data** (this device's data is replaced and nothing from it is uploaded). |

**Day to day.** Nothing to do. Changes upload about 1.5 seconds after you make them, and arrive on other devices within a second or two (Realtime), or when you switch back to the tab, come back online, or after at most 2 minutes. Offline edits are kept and sent when you reconnect. The header cloud shows the state (spinning while syncing, crossed out when offline or failing). **Settings → Account & sync → Sync now** forces a round.

**Signing out** keeps your data on the device unless you tick *Also remove my data from this device*. Signing back in to the same account continues where it left off and uploads anything you changed meanwhile.

**Delete cloud copy** (Settings → Account & sync) deletes everything stored in your account and signs you out; the data on your devices stays. To delete the **account itself**, open Supabase → **Authentication → Users** → the user → **Delete user**. That also deletes their rows, because they cascade.

**Backups.** Settings → Data → Export JSON still works and is a good habit. Supabase's paid plans add daily database backups.

---

## Checklist

- [ ] `supabase/schema.sql` (latest) ran without errors; `records`, `app_state` and `driftsync_push` exist
- [ ] Site URL and Redirect URLs include `/auth/callback` for localhost and production
- [ ] Signing in with your own email works (or custom SMTP is set up for others)
- [ ] Vercel has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and you redeployed
- [ ] Two browsers signed in to the same account see each other's changes

## Troubleshooting

| You see | Cause and fix |
| --- | --- |
| Settings says "Sync isn't set up" | The environment variables weren't there when the site was built. Check their names (they start with `NEXT_PUBLIC_`), then redeploy (Vercel) or restart `npm run dev` (local). |
| "Email address not authorized" | Supabase's built-in email only sends to members of your Supabase organization. Use your Supabase login email, invite the person to the org, or set up custom SMTP (step 4). |
| "Too many sign-in emails were sent recently" | The built-in sender allows ~2 emails/hour. Wait, or set up custom SMTP. |
| "…isn't in Supabase's allowed redirect URLs" | Add `https://your-site/auth/callback` under Authentication → URL Configuration (step 3). |
| "This sign-in link has expired or was opened in a different browser" | For security the link only works once, in the browser that requested it, and expires after an hour by default. Request a new link and open it in the same browser. On phones, long-press the link and open it in the browser you use for Driftsync rather than the mail app's built-in one. |
| "The Driftsync tables are missing…" / "The sync function is missing or outdated…" | Run the latest `supabase/schema.sql` (step 1). |
| "That sign-in method isn't enabled in Supabase" | Enable the provider in Authentication → Sign In / Providers, or remove it from `NEXT_PUBLIC_SUPABASE_PROVIDERS`. |
| Google/GitHub returns an error page | The provider's callback URL must be exactly `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`, and the Client ID/secret must be pasted into Supabase. |
| Other devices only update after a while | Realtime isn't publishing the tables: check Database → Publications → `supabase_realtime` includes `records` and `app_state`, or just run the schema again. Sync still happens on focus and every 2 minutes. |
| "Signups not allowed" | You turned off new sign-ups. Turn it back on to add a device with a new email, or sign in with the existing account's email. |

## How it works (for the curious)

- **On the device:** all reads and writes go to the local copy (`LocalStorageRepository`). Every item has an id, an `updatedAt` and a soft-delete `deletedAt`.
- **In Supabase:** `records` holds one row per item, with the item stored as JSON plus `updated_at`, `deleted_at` and the server-stamped `synced_at`. `app_state` holds your profile and settings.
- **A sync round** (`src/sync/engine.ts`):
  1. Pull rows the server stored since the last round (with 2 minutes of overlap, which is harmless because merging is repeatable) and merge them: newer `updatedAt` wins.
  2. Push local items edited since the last upload through `driftsync_push`, which again keeps whichever copy is newer, so the server and every device converge on the same result.
- **Resets and imports** turn removed items into deletions, so they disappear on your other devices too.
- **Code map:** `src/sync/config.ts` (environment), `client.ts` (Supabase client, PKCE sign-in), `supabase-remote.ts` (the two calls to Supabase), `engine.ts` (sync rules, unit-tested in `src/sync/__tests__`), `runner.ts` (when to sync, sign-in/out), `src/components/account/*` (sign-in pages, Settings section, header cloud, first-sync question).
