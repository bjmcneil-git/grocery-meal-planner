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
