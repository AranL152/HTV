"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full bg-black  px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex items-center">
          <Link href="/">
            <h1 className="text-xl font-bold text-white">level</h1>
          </Link>
        </div>

        {/* Right side - Login button */}
      </div>
    </header>
  );
}
