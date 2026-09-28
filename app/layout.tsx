import "./globals.css";
import NavBar from "./components/NavBar";
import FeedbackButton from "./components/FeedbackButton";

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
      <body className="pb-36 max-w-md mx-auto">
        {children}
        <FeedbackButton />
        <NavBar />
      </body>
    </html>
  );
}
