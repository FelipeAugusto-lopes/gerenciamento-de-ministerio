import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { AppUser, DEFAULT_USERS, UserRole } from "@/types";

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (name: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<AppUser, "id">) => void;
  deleteUser: (id: string) => void;
  isAdmin: boolean;
  canEditMinistry: (ministryId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

let nextId = Date.now();
const genId = () => String(++nextId);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => load("app_users", DEFAULT_USERS));
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => load("current_user", null));

  useEffect(() => { localStorage.setItem("app_users", JSON.stringify(users)); }, [users]);
  useEffect(() => {
    if (currentUser) localStorage.setItem("current_user", JSON.stringify(currentUser));
    else localStorage.removeItem("current_user");
  }, [currentUser]);

  const login = useCallback((name: string, password: string): boolean => {
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    if (user) { setCurrentUser(user); return true; }
    return false;
  }, [users]);

  const logout = useCallback(() => setCurrentUser(null), []);

  const addUser = useCallback((u: Omit<AppUser, "id">) => {
    setUsers(prev => [...prev, { ...u, id: genId() }]);
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const isAdmin = currentUser?.role === "admin";

  const canEditMinistry = useCallback((ministryId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.ministryId === ministryId;
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, deleteUser, isAdmin, canEditMinistry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
