# Alexa Voice Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user say "Alexa, tell my grocery list to add milk" (or "remove milk") from their kitchen Echo and have it hit the real `grocery_list` table in production, with multi-item and quantity support.

**Architecture:** A custom Alexa Skill (Development stage, self-hosted endpoint — see spec for why the third-party List API path is dead) calls a new `POST /api/alexa` route in the existing Next.js app on Vercel. The route verifies the request is genuinely from Alexa, parses the free-text slot into `{name, quantity}` items, and reuses/extends the existing `grocery_list` insert/delete logic.

**Tech Stack:** Next.js 14.2.35 (App Router, Node runtime), TypeScript strict mode, Cloudflare D1 (raw SQL via `d1Query`, no ORM), Vitest, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-24-alexa-integration-design.md`

## Global Constraints

- Path alias `@/*` resolves to the repo root (see `tsconfig.json`).
- No ORM — all DB access goes through `d1Query<T>(sql, params)` in `lib/d1.ts`.
- Tests live in `__tests__/*.test.ts`, run via `npm test` (`vitest run`).
- D1 database name is `grocery-meal-planner`. Migrations are applied with `npx wrangler d1 execute grocery-meal-planner --remote --file=./d1/migrations/<file>` — **this is the live production database. Always confirm with the user before running a `--remote` command, never run it unattended.**
- Alexa invocation name: **"my grocery list"**.
- Alexa intents: **`AddItemsIntent`** and **`RemoveItemsIntent`**, each with one slot named **`ItemsText`** of type **`AMAZON.SearchQuery`**.
- Alexa endpoint (self-hosted HTTPS web service, not Lambda): **`https://grocery-meal-planner-sigma.vercel.app/api/alexa`**.
- A spoken item with no quantity defaults to quantity **1**.
- Every Alexa response sets **`shouldEndSession: true`** (one-shot phrasing, not multi-turn).
- New `grocery_list.source` value: **`'voice'`**.
- Routes in this codebase are thin orchestration; business logic lives in `lib/*.ts` and is unit-tested there (see `lib/aisleMatcher.ts` + `__tests__/aisleMatcher.test.ts` for the established pattern, including mocking `global.fetch` to test code that calls `d1Query`/external APIs). No existing route handler has its own unit test file — that convention continues here; the Alexa route itself is verified live via the Alexa simulator (Task 8), not via Vitest.

---

### Task 1: Database migration — allow `'voice'` as a grocery_list source

**Files:**
- Create: `d1/migrations/0007_add_grocery_list_voice_source.sql`
- Modify: `lib/types.ts:38-45` (`GroceryListItem.source`)

**Interfaces:**
- Produces: `GroceryListItem.source` type is now `"planned" | "manual" | "voice"`, matching the DB's new CHECK constraint. Later tasks insert rows with `source: "voice"`.

SQLite can't `ALTER TABLE ... ADD CONSTRAINT`, so this is the standard rebuild-and-swap pattern (same one this repo doesn't have yet, but it's the only way to change a CHECK constraint in SQLite/D1).

- [ ] **Step 1: Write the migration file**

```sql
CREATE TABLE grocery_list_new (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity REAL,
  source TEXT NOT NULL CHECK (source IN ('planned', 'manual', 'voice')),
  walmart_item_id TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO grocery_list_new SELECT * FROM grocery_list;

DROP TABLE grocery_list;

ALTER TABLE grocery_list_new RENAME TO grocery_list;
```

Save this as `d1/migrations/0007_add_grocery_list_voice_source.sql`.

- [ ] **Step 2: Record the current row count (for a sanity check after the rebuild)**

Run:

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT COUNT(*) AS total FROM grocery_list"
```

Note the `total` value.

- [ ] **Step 3: Apply the migration to the remote D1 database**

**This modifies the live production database — confirm with the user before running.**

```bash
npx wrangler d1 execute grocery-meal-planner --remote --file=./d1/migrations/0007_add_grocery_list_voice_source.sql
```

- [ ] **Step 4: Verify the rebuild**

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT COUNT(*) AS total FROM grocery_list"
```

Expected: same `total` as Step 2 (no rows lost).

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT sql FROM sqlite_master WHERE name='grocery_list'"
```

Expected: the returned `CREATE TABLE` text includes `'voice'` in the `source` CHECK constraint.

- [ ] **Step 5: Update the TypeScript type**

In `lib/types.ts`, change:

```ts
export interface GroceryListItem {
  id: string;
  item_name: string;
  quantity: number | null;
  source: "planned" | "manual";
  walmart_item_id: string | null;
  added_at: string;
}
```

to:

```ts
export interface GroceryListItem {
  id: string;
  item_name: string;
  quantity: number | null;
  source: "planned" | "manual" | "voice";
  walmart_item_id: string | null;
  added_at: string;
}
```

- [ ] **Step 6: Run the existing test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add d1/migrations/0007_add_grocery_list_voice_source.sql lib/types.ts
git commit -m "Allow 'voice' as a grocery_list source"
```

---

### Task 2: Shared grocery-list helpers (`lib/groceryList.ts`)

**Files:**
- Modify: `lib/aisleMatcher.ts` (export two already-existing private functions)
- Create: `lib/groceryList.ts`
- Create: `__tests__/groceryList.test.ts`
- Modify: `app/api/grocery-list/route.ts` (use the new shared insert helper)

**Interfaces:**
- Consumes: `normalizeItemName(name: string): string` and `d1Query<T>(sql, params)` (existing, from `lib/aisleMatcher.ts` and `lib/d1.ts`).
- Produces:
  - `addGroceryItem(itemName: string, quantity: number | null, source: GroceryListItem["source"]): Promise<GroceryListItem>` — used by both the existing manual-add route and the new Alexa route (Task 6).
  - `findMatchingGroceryItems(spokenName: string, items: GroceryListItem[]): GroceryListItem[]` — used by the Alexa remove handler (Task 6).

The remove-matching logic needs the exact same "whole word, not a substring of a longer word" and "simple plural" matching the aisle matcher already uses (e.g. "pop" must not match "popcorn"). Those two helpers exist in `lib/aisleMatcher.ts` but aren't exported — export them instead of duplicating the regex logic.

- [ ] **Step 1: Export the matching helpers from `lib/aisleMatcher.ts`**

In `lib/aisleMatcher.ts`, change:

```ts
function isWholeWordSubstring(haystack: string, needle: string): boolean {
```

to:

```ts
export function isWholeWordSubstring(haystack: string, needle: string): boolean {
```

and change:

```ts
function isSimplePlural(a: string, b: string): boolean {
```

to:

```ts
export function isSimplePlural(a: string, b: string): boolean {
```

- [ ] **Step 2: Write the failing tests for `findMatchingGroceryItems`**

Create `__tests__/groceryList.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addGroceryItem, findMatchingGroceryItems } from "@/lib/groceryList";
import type { GroceryListItem } from "@/lib/types";

describe("findMatchingGroceryItems", () => {
  const items: GroceryListItem[] = [
    { id: "1", item_name: "Milk", quantity: 1, source: "manual", walmart_item_id: null, added_at: "" },
    { id: "2", item_name: "3 cloves garlic (minced)", quantity: null, source: "manual", walmart_item_id: null, added_at: "" },
    { id: "3", item_name: "Popcorn", quantity: 1, source: "manual", walmart_item_id: null, added_at: "" },
  ];

  it("matches case-insensitively on an exact name", () => {
    expect(findMatchingGroceryItems("milk", items).map((i) => i.id)).toEqual(["1"]);
  });

  it("matches a whole-word substring within a longer item name", () => {
    expect(findMatchingGroceryItems("garlic", items).map((i) => i.id)).toEqual(["2"]);
  });

  it("does not match a short name embedded in a longer unrelated word", () => {
    expect(findMatchingGroceryItems("pop", items).map((i) => i.id)).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findMatchingGroceryItems("bananas", items)).toEqual([]);
  });

  it("returns an empty array for an empty spoken name", () => {
    expect(findMatchingGroceryItems("", items)).toEqual([]);
  });
});

describe("addGroceryItem", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "db";
    process.env.CLOUDFLARE_API_TOKEN = "token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("inserts an item with the given name, quantity, and source", async () => {
    const fakeItem: GroceryListItem = {
      id: "abc",
      item_name: "milk",
      quantity: 2,
      source: "voice",
      walmart_item_id: null,
      added_at: "2026-08-24T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, errors: [], result: [{ results: [fakeItem] }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await addGroceryItem("milk", 2, "voice");

    expect(result).toEqual(fakeItem);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.sql).toContain("INSERT INTO grocery_list");
    expect(body.params).toEqual([expect.any(String), "milk", 2, "voice"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run __tests__/groceryList.test.ts
```

Expected: FAIL — `lib/groceryList.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/groceryList.ts`**

```ts
import { randomUUID } from "crypto";
import { d1Query } from "./d1";
import { normalizeItemName, isWholeWordSubstring, isSimplePlural } from "./aisleMatcher";
import type { GroceryListItem } from "./types";

export async function addGroceryItem(
  itemName: string,
  quantity: number | null,
  source: GroceryListItem["source"]
): Promise<GroceryListItem> {
  const [item] = await d1Query<GroceryListItem>(
    `INSERT INTO grocery_list (id, item_name, quantity, source)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
    [randomUUID(), itemName, quantity, source]
  );
  return item;
}

export function findMatchingGroceryItems(spokenName: string, items: GroceryListItem[]): GroceryListItem[] {
  const normalized = normalizeItemName(spokenName);
  if (!normalized) return [];

  return items.filter((item) => {
    const itemNormalized = normalizeItemName(item.item_name);
    return (
      itemNormalized === normalized ||
      isSimplePlural(itemNormalized, normalized) ||
      isWholeWordSubstring(itemNormalized, normalized) ||
      isWholeWordSubstring(normalized, itemNormalized)
    );
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run __tests__/groceryList.test.ts
```

Expected: PASS (5 + 1 tests).

- [ ] **Step 6: Refactor the existing manual-add route to use the shared helper**

In `app/api/grocery-list/route.ts`, replace the `POST` function body:

```ts
export async function POST(req: NextRequest) {
  const { item_name, quantity } = await req.json();
  if (!item_name) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const [item] = await d1Query<GroceryListItem>(
    `INSERT INTO grocery_list (id, item_name, quantity, source)
     VALUES (?, ?, ?, 'manual')
     RETURNING *`,
    [randomUUID(), item_name, quantity ?? null]
  );

  return NextResponse.json(item, { status: 201 });
}
```

with:

```ts
export async function POST(req: NextRequest) {
  const { item_name, quantity } = await req.json();
  if (!item_name) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const item = await addGroceryItem(item_name, quantity ?? null, "manual");
  return NextResponse.json(item, { status: 201 });
}
```

Update the top of the file — remove the now-unused `randomUUID` import and `d1Query` import if `d1Query` is no longer referenced directly (it's still used by `GET`, so keep it), and add the new import:

```ts
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { addGroceryItem } from "@/lib/groceryList";
import type { GroceryListItem } from "@/lib/types";
```

(`randomUUID` from `"crypto"` is no longer used in this file — remove that import line.)

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests pass, including the new `groceryList.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/aisleMatcher.ts lib/groceryList.ts __tests__/groceryList.test.ts app/api/grocery-list/route.ts
git commit -m "Extract shared grocery-list insert/match helpers"
```

---

### Task 3: Voice item parsing (`lib/voiceItems.ts`)

**Files:**
- Create: `lib/voiceItems.ts`
- Create: `__tests__/voiceItems.test.ts`

**Interfaces:**
- Produces: `parseVoiceItems(raw: string): { name: string; quantity: number }[]` — consumed by the Alexa route (Task 6) to turn the raw `ItemsText` slot value into individual items.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/voiceItems.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseVoiceItems } from "@/lib/voiceItems";

describe("parseVoiceItems", () => {
  it("defaults quantity to 1 when none is spoken", () => {
    expect(parseVoiceItems("milk")).toEqual([{ name: "milk", quantity: 1 }]);
  });

  it("parses a leading digit quantity", () => {
    expect(parseVoiceItems("2 eggs")).toEqual([{ name: "eggs", quantity: 2 }]);
  });

  it("parses a leading spelled-out quantity", () => {
    expect(parseVoiceItems("two eggs")).toEqual([{ name: "eggs", quantity: 2 }]);
  });

  it("treats a leading 'a' as quantity 1", () => {
    expect(parseVoiceItems("a loaf of bread")).toEqual([{ name: "loaf of bread", quantity: 1 }]);
  });

  it("treats a leading 'an' as quantity 1", () => {
    expect(parseVoiceItems("an apple")).toEqual([{ name: "apple", quantity: 1 }]);
  });

  it("splits a comma-separated list", () => {
    expect(parseVoiceItems("milk, eggs, bread")).toEqual([
      { name: "milk", quantity: 1 },
      { name: "eggs", quantity: 1 },
      { name: "bread", quantity: 1 },
    ]);
  });

  it("splits an 'and'-separated list", () => {
    expect(parseVoiceItems("milk and eggs")).toEqual([
      { name: "milk", quantity: 1 },
      { name: "eggs", quantity: 1 },
    ]);
  });

  it("splits an Oxford-comma list", () => {
    expect(parseVoiceItems("milk, eggs, and bread")).toEqual([
      { name: "milk", quantity: 1 },
      { name: "eggs", quantity: 1 },
      { name: "bread", quantity: 1 },
    ]);
  });

  it("handles mixed quantities across a list", () => {
    expect(parseVoiceItems("2 eggs, a loaf of bread, milk")).toEqual([
      { name: "eggs", quantity: 2 },
      { name: "loaf of bread", quantity: 1 },
      { name: "milk", quantity: 1 },
    ]);
  });

  it("trims stray whitespace and drops empty segments", () => {
    expect(parseVoiceItems("  milk ,  , eggs  ")).toEqual([
      { name: "milk", quantity: 1 },
      { name: "eggs", quantity: 1 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseVoiceItems("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(parseVoiceItems("   ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/voiceItems.test.ts
```

Expected: FAIL — `lib/voiceItems.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/voiceItems.ts`**

```ts
export interface VoiceItem {
  name: string;
  quantity: number;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const LEADING_QUANTITY = new RegExp(`^(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\s+(.+)$`, "i");

export function parseVoiceItems(raw: string): VoiceItem[] {
  const segments = raw
    .split(",")
    .flatMap((part) => part.split(/\s+and\s+/i))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return segments
    .map((segment) => {
      const match = segment.match(LEADING_QUANTITY);
      if (match) {
        const token = match[1].toLowerCase();
        const quantity = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
        return { name: match[2].trim(), quantity };
      }
      return { name: segment, quantity: 1 };
    })
    .filter((item) => item.name.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run __tests__/voiceItems.test.ts
```

Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/voiceItems.ts __tests__/voiceItems.test.ts
git commit -m "Add voice item parsing (multi-item, quantity words)"
```

---

### Task 4: Alexa response building (`lib/alexaTypes.ts`, `lib/alexaSpeech.ts`)

**Files:**
- Create: `lib/alexaTypes.ts`
- Create: `lib/alexaSpeech.ts`
- Create: `__tests__/alexaSpeech.test.ts`

**Interfaces:**
- Produces:
  - Types `AlexaSlot`, `AlexaIntent`, `AlexaRequest`, `AlexaRequestEnvelope`, `AlexaResponseEnvelope` (from `lib/alexaTypes.ts`) — consumed by the route in Task 6.
  - `formatItemList(names: string[]): string` — Oxford-comma joining, e.g. `["milk","eggs","bread"]` → `"milk, eggs, and bread"`.
  - `buildAlexaResponse(speechText: string): AlexaResponseEnvelope` — wraps plain text into the JSON shape Alexa expects, always with `shouldEndSession: true`.

- [ ] **Step 1: Create the Alexa request/response types**

Create `lib/alexaTypes.ts`:

```ts
export interface AlexaSlot {
  name: string;
  value?: string;
}

export interface AlexaIntent {
  name: string;
  slots?: Record<string, AlexaSlot>;
}

export interface AlexaRequest {
  type: "LaunchRequest" | "IntentRequest" | "SessionEndedRequest";
  requestId: string;
  timestamp: string;
  intent?: AlexaIntent;
}

export interface AlexaRequestEnvelope {
  version: string;
  request: AlexaRequest;
  context?: {
    System?: {
      application?: {
        applicationId?: string;
      };
    };
  };
}

export interface AlexaResponseEnvelope {
  version: string;
  response: {
    outputSpeech: {
      type: "PlainText";
      text: string;
    };
    shouldEndSession: boolean;
  };
}
```

- [ ] **Step 2: Write the failing tests for `alexaSpeech.ts`**

Create `__tests__/alexaSpeech.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatItemList, buildAlexaResponse } from "@/lib/alexaSpeech";

describe("formatItemList", () => {
  it("returns an empty string for no items", () => {
    expect(formatItemList([])).toBe("");
  });

  it("returns a single item unchanged", () => {
    expect(formatItemList(["milk"])).toBe("milk");
  });

  it("joins two items with 'and', no comma", () => {
    expect(formatItemList(["milk", "eggs"])).toBe("milk and eggs");
  });

  it("joins three or more items with an Oxford comma", () => {
    expect(formatItemList(["milk", "eggs", "bread"])).toBe("milk, eggs, and bread");
  });
});

describe("buildAlexaResponse", () => {
  it("builds a PlainText response envelope that ends the session", () => {
    expect(buildAlexaResponse("hello")).toEqual({
      version: "1.0",
      response: {
        outputSpeech: { type: "PlainText", text: "hello" },
        shouldEndSession: true,
      },
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run __tests__/alexaSpeech.test.ts
```

Expected: FAIL — `lib/alexaSpeech.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/alexaSpeech.ts`**

```ts
import type { AlexaResponseEnvelope } from "./alexaTypes";

export function formatItemList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function buildAlexaResponse(speechText: string): AlexaResponseEnvelope {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: speechText },
      shouldEndSession: true,
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run __tests__/alexaSpeech.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/alexaTypes.ts lib/alexaSpeech.ts __tests__/alexaSpeech.test.ts
git commit -m "Add Alexa request/response types and speech formatting"
```

---

### Task 5: Alexa request verification (`lib/alexaVerify.ts`)

**Files:**
- Create: `lib/alexaVerify.ts`
- Create: `__tests__/alexaVerify.test.ts`

**Interfaces:**
- Produces:
  - `validateCertChainUrl(rawUrl: string): boolean`
  - `isTimestampFresh(timestamp: string, now?: Date): boolean`
  - `verifyAlexaSignature(rawBody: string, signatureBase64: string, certChainUrl: string): Promise<boolean>` — consumed by the route in Task 6.

This is what makes it safe for `/api/alexa` to be a public endpoint: every request must carry a valid Amazon signature over a valid Amazon-issued certificate, checked before any database access. The cryptographic path (`verifyAlexaSignature`) depends on Amazon's real certificate infrastructure, so it is intentionally **not** unit-tested here — it's exercised for real in Task 8 via the Alexa simulator, which is the only way to generate a genuinely Amazon-signed request. The two pure pieces it's built from (`validateCertChainUrl`, `isTimestampFresh`) are fully unit-tested.

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `__tests__/alexaVerify.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateCertChainUrl, isTimestampFresh } from "@/lib/alexaVerify";

describe("validateCertChainUrl", () => {
  it("accepts a well-formed Amazon cert chain URL", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com/echo.api/echo-api-cert-6-ats.pem")).toBe(true);
  });

  it("accepts an explicit default https port", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem")).toBe(true);
  });

  it("rejects a non-https protocol", () => {
    expect(validateCertChainUrl("http://s3.amazonaws.com/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a hostname that is not s3.amazonaws.com", () => {
    expect(validateCertChainUrl("https://evil.com/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a path that does not start with /echo.api/", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com/not-echo/echo-api-cert.pem")).toBe(false);
  });

  it("rejects a non-standard port", () => {
    expect(validateCertChainUrl("https://s3.amazonaws.com:8443/echo.api/echo-api-cert.pem")).toBe(false);
  });

  it("rejects an unparseable URL", () => {
    expect(validateCertChainUrl("not a url")).toBe(false);
  });
});

describe("isTimestampFresh", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("accepts a timestamp equal to now", () => {
    expect(isTimestampFresh("2026-08-24T12:00:00.000Z", now)).toBe(true);
  });

  it("accepts a timestamp 100 seconds old", () => {
    expect(isTimestampFresh("2026-08-24T11:58:20.000Z", now)).toBe(true);
  });

  it("rejects a timestamp 200 seconds old", () => {
    expect(isTimestampFresh("2026-08-24T11:56:40.000Z", now)).toBe(false);
  });

  it("rejects a timestamp 200 seconds in the future", () => {
    expect(isTimestampFresh("2026-08-24T12:03:20.000Z", now)).toBe(false);
  });

  it("rejects an unparseable timestamp", () => {
    expect(isTimestampFresh("not-a-date", now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/alexaVerify.test.ts
```

Expected: FAIL — `lib/alexaVerify.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/alexaVerify.ts`**

```ts
import crypto from "node:crypto";

const CERT_CHAIN_HOSTNAME = "s3.amazonaws.com";
const CERT_CHAIN_PATH_PREFIX = "/echo.api/";
const REQUIRED_SAN = "echo-api.amazon.com";
const TIMESTAMP_TOLERANCE_SECONDS = 150;

export function validateCertChainUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname.toLowerCase() !== CERT_CHAIN_HOSTNAME) return false;
  if (!url.pathname.startsWith(CERT_CHAIN_PATH_PREFIX)) return false;
  if (url.port !== "" && url.port !== "443") return false;
  return true;
}

export function isTimestampFresh(timestamp: string, now: Date = new Date()): boolean {
  const requestTime = new Date(timestamp).getTime();
  if (Number.isNaN(requestTime)) return false;
  const diffSeconds = Math.abs(now.getTime() - requestTime) / 1000;
  return diffSeconds <= TIMESTAMP_TOLERANCE_SECONDS;
}

export async function verifyAlexaSignature(
  rawBody: string,
  signatureBase64: string,
  certChainUrl: string
): Promise<boolean> {
  if (!validateCertChainUrl(certChainUrl)) return false;

  const res = await fetch(certChainUrl);
  if (!res.ok) return false;
  const pem = await res.text();

  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(pem);
  } catch {
    return false;
  }

  const now = new Date();
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) return false;
  if (!cert.checkHost(REQUIRED_SAN)) return false;

  try {
    const verifier = crypto.createVerify("RSA-SHA1");
    verifier.update(rawBody);
    return verifier.verify(cert.publicKey, signatureBase64, "base64");
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run __tests__/alexaVerify.test.ts
```

Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/alexaVerify.ts __tests__/alexaVerify.test.ts
git commit -m "Add Alexa request signature/timestamp verification"
```

---

### Task 6: The Alexa webhook route (`app/api/alexa/route.ts`)

**Files:**
- Create: `app/api/alexa/route.ts`

**Interfaces:**
- Consumes: everything produced in Tasks 2–5 (`addGroceryItem`, `findMatchingGroceryItems`, `parseVoiceItems`, `formatItemList`, `buildAlexaResponse`, `verifyAlexaSignature`, `isTimestampFresh`, the Alexa types) plus `d1Query` from `lib/d1.ts`.
- Produces: `POST /api/alexa`, the endpoint the Alexa skill (Task 7) calls.

No automated test file for this task — per the Global Constraints, route handlers in this codebase aren't unit-tested, and this one specifically can't be meaningfully exercised outside real Alexa traffic (it requires a genuine Amazon signature). It's verified live in Task 8.

- [ ] **Step 1: Implement `app/api/alexa/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { d1Query } from "@/lib/d1";
import { verifyAlexaSignature, isTimestampFresh } from "@/lib/alexaVerify";
import { parseVoiceItems } from "@/lib/voiceItems";
import { addGroceryItem, findMatchingGroceryItems } from "@/lib/groceryList";
import { formatItemList, buildAlexaResponse } from "@/lib/alexaSpeech";
import type { AlexaRequestEnvelope, AlexaResponseEnvelope } from "@/lib/alexaTypes";
import type { GroceryListItem } from "@/lib/types";

const HELP_TEXT = "You can say things like, add milk, or remove eggs.";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("signature");
  const certChainUrl = req.headers.get("signaturecertchainurl");

  if (!signature || !certChainUrl) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const verified = await verifyAlexaSignature(rawBody, signature, certChainUrl);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const envelope: AlexaRequestEnvelope = JSON.parse(rawBody);

  if (!isTimestampFresh(envelope.request.timestamp)) {
    return NextResponse.json({ error: "Stale request" }, { status: 401 });
  }

  const skillId = process.env.ALEXA_SKILL_ID;
  if (skillId && envelope.context?.System?.application?.applicationId !== skillId) {
    return NextResponse.json({ error: "Unrecognized application" }, { status: 401 });
  }

  const { request } = envelope;

  if (request.type === "SessionEndedRequest") {
    return NextResponse.json(buildAlexaResponse(""));
  }

  if (request.type === "LaunchRequest") {
    return NextResponse.json(buildAlexaResponse(`Welcome to my grocery list. ${HELP_TEXT}`));
  }

  if (request.type === "IntentRequest" && request.intent) {
    const intentName = request.intent.name;
    const itemsText = request.intent.slots?.ItemsText?.value ?? "";

    if (intentName === "AddItemsIntent") {
      return NextResponse.json(await handleAddItems(itemsText));
    }

    if (intentName === "RemoveItemsIntent") {
      return NextResponse.json(await handleRemoveItems(itemsText));
    }

    if (intentName === "AMAZON.HelpIntent") {
      return NextResponse.json(buildAlexaResponse(HELP_TEXT));
    }

    if (intentName === "AMAZON.CancelIntent" || intentName === "AMAZON.StopIntent") {
      return NextResponse.json(buildAlexaResponse("Goodbye."));
    }
  }

  return NextResponse.json(buildAlexaResponse("Sorry, I didn't understand that."));
}

async function handleAddItems(itemsText: string): Promise<AlexaResponseEnvelope> {
  const parsedItems = parseVoiceItems(itemsText);
  if (parsedItems.length === 0) {
    return buildAlexaResponse("Sorry, I didn't catch what to add. Try again.");
  }

  try {
    for (const { name, quantity } of parsedItems) {
      await addGroceryItem(name, quantity, "voice");
    }
  } catch (err) {
    console.error("Alexa add items failed", err);
    return buildAlexaResponse("Sorry, something went wrong adding that to your list.");
  }

  const names = parsedItems.map((item) => (item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name));
  return buildAlexaResponse(`Added ${formatItemList(names)} to your grocery list.`);
}

async function handleRemoveItems(itemsText: string): Promise<AlexaResponseEnvelope> {
  const parsedItems = parseVoiceItems(itemsText);
  if (parsedItems.length === 0) {
    return buildAlexaResponse("Sorry, I didn't catch what to remove. Try again.");
  }

  try {
    const currentItems = await d1Query<GroceryListItem>("SELECT * FROM grocery_list");
    const removedNames: string[] = [];
    const notFoundNames: string[] = [];

    for (const { name } of parsedItems) {
      const matches = findMatchingGroceryItems(name, currentItems);
      if (matches.length === 0) {
        notFoundNames.push(name);
        continue;
      }
      for (const match of matches) {
        await d1Query("DELETE FROM grocery_list WHERE id = ?", [match.id]);
      }
      removedNames.push(name);
    }

    const parts: string[] = [];
    if (removedNames.length > 0) parts.push(`Removed ${formatItemList(removedNames)}.`);
    if (notFoundNames.length > 0) parts.push(`I couldn't find ${formatItemList(notFoundNames)} on your list.`);
    return buildAlexaResponse(parts.join(" ") || "Nothing was removed.");
  } catch (err) {
    console.error("Alexa remove items failed", err);
    return buildAlexaResponse("Sorry, something went wrong removing that from your list.");
  }
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (this task adds no new tests, but confirms the new route file has no type errors that break the build's test collection).

- [ ] **Step 3: Run the linter**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/alexa/route.ts
git commit -m "Add Alexa webhook route (add/remove items by voice)"
```

- [ ] **Step 5: Push and deploy**

```bash
git push
```

Confirm with the user before pushing (this triggers a production Vercel deploy). Once deployed, `https://grocery-meal-planner-sigma.vercel.app/api/alexa` exists and will 401 on any request without a valid Alexa signature — that's expected and correct at this point; it can't be exercised further until Task 7 gives Alexa something to sign requests with.

---

### Task 7: Amazon Developer Console skill setup

**This task cannot be automated by an agent — it requires logging into the user's own Amazon developer account. Perform these steps yourself (the user), using the exact values below. Ask the assistant if anything is unclear.**

**Interfaces:**
- Produces: a Skill ID, which gets set as the `ALEXA_SKILL_ID` environment variable on Vercel (tightens the check already written into Task 6's route — requests must claim to come from this specific skill).

- [ ] **Step 1: Create the skill**

Go to [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask), click "Create Skill". Name it "My Grocery List", choose "Custom" model, "Provision your own" for hosting (not Alexa-hosted), and create it.

- [ ] **Step 2: Set the invocation name**

In the left sidebar under "Interaction Model" → "Invocation", set the skill invocation name to:

```
my grocery list
```

Save.

- [ ] **Step 3: Add the intents and slot via the JSON Editor**

Under "Interaction Model" → "JSON Editor", replace the intents array (keep the existing built-in intents like `AMAZON.HelpIntent`, `AMAZON.CancelIntent`, `AMAZON.StopIntent`, `AMAZON.NavigateHomeIntent` that scaffolding already generated) and add:

```json
{
  "name": "AddItemsIntent",
  "slots": [
    { "name": "ItemsText", "type": "AMAZON.SearchQuery" }
  ],
  "samples": [
    "add {ItemsText}",
    "add {ItemsText} to my list",
    "put {ItemsText} on my list"
  ]
},
{
  "name": "RemoveItemsIntent",
  "slots": [
    { "name": "ItemsText", "type": "AMAZON.SearchQuery" }
  ],
  "samples": [
    "remove {ItemsText}",
    "remove {ItemsText} from my list",
    "take {ItemsText} off my list"
  ]
}
```

Save, then click "Build Model" and wait for it to finish.

- [ ] **Step 4: Configure the endpoint**

Under "Endpoint", select "HTTPS", and set the default region URL to:

```
https://grocery-meal-planner-sigma.vercel.app/api/alexa
```

For the SSL certificate type, select "My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority" (Vercel's `*.vercel.app` cert satisfies this). Save.

- [ ] **Step 5: Note the Skill ID and set it on Vercel**

Copy the Skill ID shown at the top of the console (starts with `amzn1.ask.skill.`). In the Vercel project settings for `grocery-meal-planner`, add an environment variable:

```
ALEXA_SKILL_ID=<the skill ID you copied>
```

Redeploy the project (Vercel dashboard → Deployments → Redeploy on the latest one) so the running function picks up the new env var.

- [ ] **Step 6: Enable the skill for testing**

Under the "Test" tab in the developer console, switch the testing stage from "Off" to "Development". This is required for the skill to respond on any device signed into this account, including the kitchen Echo.

---

### Task 8: End-to-end verification

**This task involves live testing against the real production database and a real device. Perform it after Task 7 is complete.**

- [ ] **Step 1: Test via the console simulator — add**

In the "Test" tab, type or say: `open my grocery list and add milk and two eggs`. Confirm the simulated response is something like "Added milk and 2 eggs to your grocery list."

- [ ] **Step 2: Verify the rows landed in production**

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT item_name, quantity, source FROM grocery_list WHERE source='voice' ORDER BY added_at DESC LIMIT 5"
```

Expected: rows for "milk" (quantity 1) and "eggs" (quantity 2), `source = 'voice'`.

- [ ] **Step 3: Test via the console simulator — remove**

Type or say: `open my grocery list and remove milk`. Confirm the response is "Removed milk." and re-run the query from Step 2 to confirm the milk row is gone.

- [ ] **Step 4: Test the "not found" path**

Type or say: `open my grocery list and remove giraffes`. Confirm the response is "I couldn't find giraffes on your list."

- [ ] **Step 5: Clean up any remaining test rows**

Delete by `id`, not by name — matching on `item_name` risks deleting a real, already-existing item that happens to share a name with a test item (this repo has hit exactly that collision before, see the `groceryList.test.ts` "3 cloves garlic" case). List the current voice-sourced rows to get their ids:

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="SELECT id, item_name FROM grocery_list WHERE source='voice'"
```

Then delete only the ones that were test artifacts from Steps 1–4 (e.g. any leftover "eggs" row), one id at a time:

```bash
npx wrangler d1 execute grocery-meal-planner --remote --command="DELETE FROM grocery_list WHERE id='<id-from-the-select-above>'"
```

**Confirm with the user before running any delete** — it's the live production database.

- [ ] **Step 6: Test on the real kitchen Echo**

Say: "Alexa, tell my grocery list to add paper towels." Confirm Alexa responds out loud, then check the `/grocery-list` page in the app (or query the DB) to confirm "paper towels" appears with `source = 'voice'`. Remove it afterward the same way (voice or the app's × button) if it's not something actually needed.
