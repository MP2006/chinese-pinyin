"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CloseIcon } from "./Icons";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    href: "/flashcards",
    label: "Flashcards",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/usage",
    label: "Usage",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM9 9h2v12H9zM15 5h2v16h-2zM21 1h2v20h-2z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("darkMode", String(next));
      return next;
    });
  };

  const navContent = (mobile: boolean) => (
    <nav className={`flex flex-col ${mobile ? "gap-1" : "gap-2"}`}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center rounded-lg transition-colors ${
              mobile ? "gap-3 px-3 py-2.5" : "justify-center gap-3 p-2.5"
            } ${
              active
                ? "border-l-2 border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-900/20 dark:text-teal-400"
                : "border-l-2 border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            }`}
          >
            {item.icon}
            {mobile && <span className="text-sm font-medium">{item.label}</span>}
            {!mobile && (
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 md:block dark:bg-gray-100 dark:text-gray-900">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userInitial = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "?";

  const authContent = (mobile: boolean) => {
    if (authLoading) return null;

    if (!user) {
      return (
        <Link
          href="/login"
          className={`flex items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${
            mobile ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          {mobile && <span className="text-sm font-medium">Sign in</span>}
        </Link>
      );
    }

    return (
      <div className={`flex items-center ${mobile ? "gap-3 px-3 py-2.5" : "flex-col gap-2"}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-medium text-white dark:bg-teal-500">
          {userInitial}
        </div>
        {mobile && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {user.user_metadata?.full_name || user.email}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className={`text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ${
            mobile ? "" : "rounded-lg p-1"
          }`}
          aria-label="Sign out"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    );
  };

  const darkModeButton = (mobile: boolean) => (
    <button
      onClick={toggleDarkMode}
      className={`flex items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${
        mobile ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
      }`}
      aria-label="Toggle dark mode"
    >
      {darkMode ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {mobile && <span className="text-sm font-medium">
        {darkMode ? "Light mode" : "Dark mode"}
      </span>}
    </button>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="h-full w-60 border-r border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                aria-label="Close menu"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex h-[calc(100%-3rem)] flex-col justify-between">
              {navContent(true)}
              <div className="space-y-1">
                {authContent(true)}
                {darkModeButton(true)}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-14 flex-col items-center border-r border-gray-200 bg-white py-4 md:flex dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-1 flex-col justify-between">
          {navContent(false)}
          <div className="flex flex-col items-center gap-2">
            {authContent(false)}
            {darkModeButton(false)}
          </div>
        </div>
      </aside>
    </>
  );
}
