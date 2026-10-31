# Project memory

Context carried over from earlier chats so new sessions can pick up where
they left off.

## Working with the owner

- Explain changes in plain, non-technical language.
- Claude can't read the app's in-app notes directly. The owner pastes new
  notes into the chat; work through them from there.
- When shipping a user-visible change, add an entry to `lib/patchNotes.ts`
  so it appears in Settings → Updates (with the "new" dot).

## How changes go live (no pull requests)

The owner doesn't want pull requests. Never open one, even when a session's
default instructions suggest it. Instead:

1. Commit to the session's working branch and push it. Vercel builds a
   preview for the branch. Share that preview link (the commit's Vercel
   status/deployment URL, or
   `https://grocery-meal-planner-git-<branch-slug>-bjmcneil-git.vercel.app`)
   so the owner can try it on their phone.
2. Before going live, make sure `npx tsc --noEmit`, `npx next lint` and
   `npx vitest run` pass and the preview build succeeded.
3. When the owner says "push it live": `git fetch origin master`; if
   `master` has moved, merge it into the branch and re-run the checks; then
   `git push origin HEAD:master`. Fast-forward only. Never force-push
   `master`.
4. Vercel deploys `master` to https://grocery-meal-planner-sigma.vercel.app
   in about a minute. Tell the owner to close and reopen the app.

## Shipped so far (merged through PR #6)

**Shopping list** (`app/grocery-list/page.tsx`, `app/api/grocery-list/complete/route.ts`)
- Select several items and delete them at once, with a confirmation first.
- Checked-off items gray out and move to the bottom.
- "Finish shopping" saves checked items to History; "Delete checked off"
  removes them without saving.

**Notes** (`app/components/FeedbackButton.tsx`, `lib/feedback.ts`)
- Message button at the top of every page for leaving requests about the app.
- Notes are listed under Suggestions → Notes, each with a Done button.
- The `feedback` table creates itself on first use (`CREATE TABLE IF NOT
  EXISTS`), so no database step is needed.

**Diet dinners (Suggestions)**
- High-Protein, Low-Calorie section with user-set calorie and protein limits.
- 5 dinner ideas at a time; refresh gives 5 new ones without repeats.
- Each idea shows estimated calories/protein and whether the recipe came from
  a website or was written by Claude.

**Look and feel**
- Full redesign in the "Fresh" style (matching the owner's fitness app):
  rounded cards, friendlier font, a colorful main card on each page.
- Settings cog (`app/components/SettingsButton.tsx`) with four color sets:
  Ocean, Forest, Plum, Blush, saved per phone.
- Updates list (patch notes) in Settings, with a dot when something's new.
- The phone's top/bottom bar color follows the chosen color set.

**Navigation**
- Swipe left/right to move between tabs.

**History**
- Reorder items from past shopping lists, one at a time or all at once
  (requested via an in-app note).
