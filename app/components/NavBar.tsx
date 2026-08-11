"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/grocery-list", label: "List" },
  { href: "/history", label: "History" },
  { href: "/recipes", label: "Recipes" },
  { href: "/suggestions", label: "Suggest" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t bg-white py-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-xs px-2 py-1 ${
            pathname === link.href ? "font-bold text-pink-600" : "text-gray-500"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
