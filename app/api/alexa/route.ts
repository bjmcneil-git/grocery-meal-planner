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
  if (!skillId) {
    console.error("ALEXA_SKILL_ID is not configured; rejecting request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (envelope.context?.System?.application?.applicationId !== skillId) {
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

  const added: string[] = [];
  const failed: string[] = [];

  for (const { name, quantity } of parsedItems) {
    try {
      await addGroceryItem(name, quantity, "voice");
      added.push(quantity > 1 ? `${quantity} ${name}` : name);
    } catch (err) {
      console.error("Alexa add item failed", name, err);
      failed.push(name);
    }
  }

  if (added.length === 0) {
    return buildAlexaResponse("Sorry, something went wrong adding that to your list.");
  }

  const parts = [`Added ${formatItemList(added)} to your grocery list.`];
  if (failed.length > 0) {
    parts.push(`Something went wrong with ${formatItemList(failed)}.`);
  }
  return buildAlexaResponse(parts.join(" "));
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
      removedNames.push(...matches.map((m) => m.item_name));
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
