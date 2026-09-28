import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureFeedbackTable, resetFeedbackTableCacheForTests } from "@/lib/feedback";

describe("ensureFeedbackTable", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "db";
    process.env.CLOUDFLARE_API_TOKEN = "token";
    resetFeedbackTableCacheForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function okResponse() {
    return {
      ok: true,
      json: async () => ({ success: true, errors: [], result: [{ results: [] }] }),
    };
  }

  it("creates the table if missing, only once per server instance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await ensureFeedbackTable();
    await ensureFeedbackTable();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sql).toContain("CREATE TABLE IF NOT EXISTS feedback");
  });

  it("retries on the next call after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, errors: [{ message: "boom" }], result: [] }),
      })
      .mockResolvedValueOnce(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(ensureFeedbackTable()).rejects.toThrow("D1 query failed");
    await ensureFeedbackTable();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
