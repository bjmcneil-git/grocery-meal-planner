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
