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
