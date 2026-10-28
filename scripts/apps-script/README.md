# Militia database sheet: deploy guide

`Code.gs` is a Google Apps Script web app that stores every recruit in a Google
Sheet. Set it up once, paste its URL into the site's environment, and the site
switches from browser only storage to the shared sheet.

## 1. Make the spreadsheet

1. Go to <https://sheets.new> and name it something like `Militia War Room`.
2. Leave it empty. The script creates the `Recruits` and `Leaderboard` tabs on
   the first sign up.

## 2. Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `myFunction` code.
3. Paste the whole contents of [Code.gs](Code.gs).
4. Save (⌘S / Ctrl+S).

## 3. Check it works

Pick `selfTest` in the function dropdown, press **Run**, allow the permissions
Google asks for, then open **Execution log**. The last line should read:

```
PASS. Delete the "selftest" row before going live.
```

Delete the `selftest` row from the `Recruits` tab.

## 4. Deploy it

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. **Deploy**, then **Authorize access**. Google warns the app is unverified;
   that is expected for your own script. Choose **Advanced → Go to (project name)**.
5. Copy the **Web app URL**, which looks like
   `https://script.google.com/macros/s/AKfy.../exec`.

"Anyone" is required because the site calls the URL from its server without
Google credentials. The URL is unguessable, and the
[shared secret](#shared-secret-recommended) below adds a second lock.

## 5. Point the site at it

Add the environment variable in Vercel (**Project → Settings → Environment
Variables**), then redeploy:

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy.../exec
SESSION_SECRET=<a long random string, required once the sheet is on>
```

The site now signs people in on the server and stores everyone in the sheet.
The radar, leaderboard, faction war and live notifications all go live.

## Shared secret (recommended)

This sheet holds wallets and the script can read them back, so lock it with a
secret as well as the URL. The secret lives in Script Properties, never in
`Code.gs`, because the repo is public.

1. Generate one: `openssl rand -base64 32`.
2. In the Apps Script editor: **Project Settings** (gear icon) → **Script
   Properties** → **Add script property**. Property `SHARED_SECRET`, value the
   string from step 1. **Save script properties**.
3. In Vercel, add `SHEETS_WEBHOOK_SECRET` with the **same** value and redeploy
   the site.

No script redeploy is needed: Script Properties apply immediately. To check,
open your web app URL with `?version` on the end. It should show
`"secured":true`. Run `selfTest` again and it reports `shared secret : on`.

## Updating an existing sheet to version 4

Version 4 adds Approved At and Intel Reply. Same as before: paste the new
`Code.gs` and deploy a new version; the headers are added on the next save and
nothing else moves.

## Updating an existing sheet to version 3

Version 3 adds the Quote Link, Comment Link and Era columns. Paste the new
`Code.gs` and deploy a new version (below). The script adds the three headers to
your existing sheet on its next save and refreshes the Leaderboard tab; nothing
else moves. Until you redeploy, the answers are still saved, inside the hidden
Data column.

## Re-deploying after an edit

A new deployment gets a new URL. To keep the existing one:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

## What lands in the sheet

**Recruits** has one row per recruit:

| Column | Value |
| --- | --- |
| Handle | X handle |
| XP, Rank | Current XP and rank |
| Faction, Soldier | Faction from the soldier's background, and the soldier number |
| Wallet | Mint wallet, if they added one |
| Invites | People who joined through their link and counted |
| Referred By | Who invited them |
| Invite Counts | Whether this account was eligible to count as an invite |
| Best Sweep | No longer used (the game was removed); stays 0. Kept so existing sheets keep their column layout |
| Tasks Done | Tasks completed |
| Joined At, Updated At | Timestamps |
| X User ID | Set when Sign in with X is on |
| Data | Hidden. The full record the site reads back. **Do not edit it.** |
| Quote Link | Link to their quote of your post (step 3) |
| Comment Link | Link to their comment tagging 3 friends (step 4) |
| Era | Their answer to "When did you pick up your first NFT?" (step 5) |
| Approved At | When they moved from Pending to Approved (blank while pending) |
| Intel Reply | Their verified "$intel" reply under the approval post |

**Leaderboard** is the same list sorted by XP, kept up to date by a formula.
Browse and filter there. Sorting or filtering the Recruits tab is also safe:
the script finds every recruit by handle, never by row position.

## Exporting the allowlist

Open **Leaderboard**, filter Rank to LIEUTENANT and CAPTAIN (or your cutoff),
and copy the Wallet column. **File → Download → CSV** also works.

## Limits

Apps Script answers in roughly half a second to two seconds and handles one
write at a time. That is fine for a launch. The site caches the full list for
20 seconds per server, so the radar and leaderboard can lag by up to that
much. If traffic outgrows it, the Upstash variables in `.env.example` are a
drop in replacement.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Site still says progress is saved in your browser | `GOOGLE_SHEETS_WEBAPP_URL` not set, or set without a redeploy |
| `Sheets web app returned 401/403` | Access isn't "Anyone", or the deployment was never authorised |
| `Sheets web app: unauthorised` | `SHARED_SECRET` (Script Properties) and `SHEETS_WEBHOOK_SECRET` (Vercel) don't match, or Vercel wasn't redeployed |
| Edits to `Code.gs` have no effect | Saved but not deployed as a new version |
| `?version` on the URL shows an old number | Same as above |
