// Sharing a pin (from the app, its in-app browser, or pinterest.com itself)
// hands out a pin.it/pinterest.com link to the *pin*, not the recipe site
// it points to - fetching that link ourselves gets Pinterest's own page,
// which has no recipe data. Pinterest's server-rendered pin page embeds the
// real outbound URL in its page data as a `"link":"..."` field, so we pull
// that out and import from there instead.

export function isPinterestShareLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "pin.it" || host === "pinterest.com" || host.endsWith(".pinterest.com");
  } catch {
    return false;
  }
}

export function extractPinterestDestination(html: string): string | null {
  const linkFieldRegex = /"link":"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkFieldRegex.exec(html)) !== null) {
    if (!match[1]) continue;
    let decoded: string;
    try {
      decoded = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    if (/^https?:\/\//.test(decoded) && !isPinterestShareLink(decoded)) {
      return decoded;
    }
  }
  return null;
}
