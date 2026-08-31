import { NextRequest, NextResponse } from "next/server";
import { parseRecipeFromHtml } from "@/lib/recipeParser";
import { isPinterestShareLink, extractPinterestDestination } from "@/lib/pinterest";

// A bare "Mozilla/5.0" gets 403'd by Cloudflare-protected WordPress recipe
// sites (confirmed on stroller-envy.com) - a realistic full browser UA
// string gets through.
const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let targetUrl = url;
  if (isPinterestShareLink(url)) {
    try {
      const pinRes = await fetch(url, { headers: { "User-Agent": FETCH_USER_AGENT } });
      if (pinRes.ok) {
        const dest = extractPinterestDestination(await pinRes.text());
        if (dest) targetUrl = dest;
      }
    } catch {
      // fall through and try the original url below, which will surface a normal error
    }
  }

  let html: string;
  try {
    const res = await fetch(targetUrl, { headers: { "User-Agent": FETCH_USER_AGENT } });
    if (res.status === 403 || res.status === 429) {
      return NextResponse.json(
        { error: "This site blocks automatic recipe imports — paste the ingredients manually instead" },
        { status: 502 }
      );
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Could not fetch that URL" }, { status: 502 });
  }

  const parsed = parseRecipeFromHtml(html);
  if (!parsed) {
    return NextResponse.json(
      { error: "No recipe data found on that page — paste the ingredients manually instead" },
      { status: 422 }
    );
  }
  return NextResponse.json({ ...parsed, sourceUrl: targetUrl });
}
