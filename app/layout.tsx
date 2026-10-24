import "./globals.css";
import { Nunito } from "next/font/google";
import NavBar from "./components/NavBar";
import SwipeTabs from "./components/SwipeTabs";
import { PALETTE_BOOT_SCRIPT } from "@/lib/theme";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = {
  title: "Grocery & Meal Planner",
  manifest: "/manifest.json",
};

// No themeColor here on purpose, and no <meta name="theme-color"> in the JSX:
// a React- or Next-rendered tag gets re-added with its fixed color next to
// ours, and phones keep using that one. PALETTE_BOOT_SCRIPT creates the only
// tag and lib/theme.ts recolors it to the chosen palette.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-palette is set before paint by the boot script, so it differs from
    // the server render on purpose.
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans pb-28 max-w-md mx-auto bg-app text-ink antialiased overflow-x-clip">
        <SwipeTabs>{children}</SwipeTabs>
        <NavBar />
      </body>
    </html>
  );
}
