// "Updates" in the Settings sheet, newest first. Add an entry at the top when
// shipping something people will notice; the cog shows a dot until the
// newest entry has been seen on that phone.

export interface PatchNote {
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    date: "2026-10-24",
    title: "Swipe between tabs",
    changes: [
      "Swipe left or right on any main page to move to the next or previous tab.",
      "The page follows your finger; a short or mostly up-and-down swipe just scrolls.",
    ],
  },
  {
    date: "2026-10-24",
    title: "A fresh new look",
    changes: [
      "Rounded cards, a friendlier font, and a colorful card for each page's main job.",
      "Pick your colors in Settings: Ocean, Forest, Plum or Blush. Each phone remembers its own.",
      "The Settings cog and the note button now sit at the top of every page.",
    ],
  },
  {
    date: "2026-10-18",
    title: "Diet dinner ideas",
    changes: [
      "New High-Protein, Low-Calorie Dinners section on Suggestions, with your own calorie and protein limits.",
      "5 dinners at a time. Tap “Show me 5 different dinners” for new ones without repeats.",
      "Each idea shows estimated calories and protein, and where the recipe came from.",
    ],
  },
  {
    date: "2026-09-28",
    title: "Shopping list upgrades",
    changes: [
      "Select several items and delete them at once.",
      "Checked items move to the bottom, grayed out.",
      "Finish shopping saves checked items to History; Delete checked off removes them without saving.",
      "Leave notes about the app with the message button; read them on Suggestions.",
    ],
  },
  {
    date: "2026-09-01",
    title: "Recipe extras",
    changes: [
      "Add your own cuisine instead of picking “Other”.",
      "Google search shortcut next to Pinterest on Recipes.",
      "A new app icon.",
    ],
  },
  {
    date: "2026-08-31",
    title: "Import from text and screenshots",
    changes: [
      "Paste a recipe's text or add a screenshot, and the app fills in the recipe for you.",
      "Crop the dish photo to use as the recipe's picture.",
    ],
  },
  {
    date: "2026-08-30",
    title: "Suggestions and Pinterest",
    changes: [
      "Suggestions tab: ask for recipe ideas by ingredient or from what you've cooked.",
      "Search Pinterest from Recipes, and share a Pinterest recipe straight into the app.",
      "Pick just the ingredients you need to add to the shopping list.",
    ],
  },
  {
    date: "2026-08-29",
    title: "History and Walmart",
    changes: [
      "History tab with past dinners and completed shopping lists.",
      "Buy any item on Walmart with one tap.",
      "Planned dinners show as picture cards.",
    ],
  },
  {
    date: "2026-08-24",
    title: "Alexa",
    changes: ["Add or remove shopping list items by voice with Alexa."],
  },
];

// Date plus title, so two updates on the same day still count as new.
export function updateId(note: PatchNote): string {
  return `${note.date} ${note.title}`;
}

export const LATEST_UPDATE = updateId(PATCH_NOTES[0]);
export const UPDATES_SEEN_KEY = "updates-seen";

export function formatUpdateDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
