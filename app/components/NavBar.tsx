"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M4 4.5c1.8-1 4.2-1 6 0v11c-1.8-1-4.2-1-6 0v-11ZM16 4.5c-1.8-1-4.2-1-6 0v11c1.8-1 4.2-1 6 0v-11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 3.5V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 3v.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 9.5l1.3 1.3L11 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path
        d="M10 2.5a5 5 0 0 0-3 9c.6.45 1 1.15 1 1.9V14h4v-.6c0-.75.4-1.45 1-1.9a5 5 0 0 0-3-9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.3 16.5h3.4M8.7 18h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6v4l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Meal Planner", Icon: CalendarIcon },
  { href: "/recipes", label: "Recipes", Icon: BookIcon },
  { href: "/grocery-list", label: "Shopping List", Icon: ClipboardIcon },
  { href: "/suggestions", label: "Suggestions", Icon: LightbulbIcon },
  { href: "/history", label: "History", Icon: ClockIcon },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around gap-1 border-t bg-white px-1 py-1.5">
      {LINKS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 text-center leading-tight text-[11px] ${
              active ? "bg-pink-50 font-bold text-pink-600" : "text-gray-500"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
