import "./globals.css";
import { Nunito } from "next/font/google";
import NavBar from "./components/NavBar";
import { PALETTE_BOOT_SCRIPT, PALETTES } from "@/lib/theme";

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

export const viewport = {
  themeColor: PALETTES[0].swatch.grad1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-palette is set before paint by the boot script, so it differs from
    // the server render on purpose.
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans pb-28 max-w-md mx-auto bg-app text-ink antialiased">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
