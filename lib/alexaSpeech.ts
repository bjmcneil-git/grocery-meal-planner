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
