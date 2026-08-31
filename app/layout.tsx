import "./globals.css";
import NavBar from "./components/NavBar";

export const metadata = {
  title: "Grocery & Meal Planner",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#db2777",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-20 max-w-md mx-auto">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
