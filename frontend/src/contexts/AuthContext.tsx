"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Check for existing authentication on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated");
    const savedUsername = localStorage.getItem("username");
    if (authStatus === "true" && savedUsername) {
      setIsAuthenticated(true);
      setUsername(savedUsername);
    }
  }, []);

  const login = (email: string) => {
    const emailUsername = email.split("@")[0];
    setIsAuthenticated(true);
    setUsername(emailUsername);
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("username", emailUsername);

    // Save username to text file (for demo purposes)
    // In a real app, you'd save to a database
    console.log(`User logged in: ${emailUsername}`);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUsername(null);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("username");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
