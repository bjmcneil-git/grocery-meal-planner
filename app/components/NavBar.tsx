"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Meal Planner" },
  { href: "/recipes", label: "Recipes" },
  { href: "/grocery-list", label: "Shopping List" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/history", label: "History" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t bg-white py-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-xs px-1 py-1 text-center leading-tight ${
            pathname === link.href ? "font-bold text-pink-600" : "text-gray-500"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
