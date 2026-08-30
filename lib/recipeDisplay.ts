// Recipe names are often full titles with a subtitle tacked on (e.g. a blog
// post's SEO title) - keep only the part before the first separator so a
// card fits on one line without truncating mid-word on a phone screen.
export function shortenRecipeName(name: string): string {
  const cut = name.split(/\s[–—-]\s|\s\(/)[0].trim();
  return cut || name;
}
