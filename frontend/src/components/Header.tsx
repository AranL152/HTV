"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  isLandingPage?: boolean;
}

export default function Header({ isLandingPage = false }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, username, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="w-full bg-black px-4 py-3 relative z-50">
      <div className="flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex items-center">
          <Link href="/">
            <h1 className="text-xl font-bold text-white">level</h1>
          </Link>
        </div>

        {/* Right side - Conditional content */}
        <div className="flex items-center gap-3">
          {!isAuthenticated && isLandingPage ? (
            // Not authenticated and on landing page - Show login button
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 font-bold text-gray text-sm rounded-lg hover:text-gray-100 transition-all duration-300"
            >
              <LogIn size={16} />
              login
            </Link>
          ) : isAuthenticated ? (
            // Authenticated - Show username and logout
            <>
              <span className="text-white text-sm font-medium">{username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2  text-white text-sm font-medium rounded-lg  transition-all duration-300"
              >
                <LogOut size={16} />
                logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
