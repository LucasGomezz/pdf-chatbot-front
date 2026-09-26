'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null,
  login: () => {}, logout: () => {}, loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
    }
    setLoading(false);
  }, []);

  function login(t: string, u: AuthUser) {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // 'chat_session' debe coincidir con SESSION_KEY en app/chat/page.tsx — sin esto,
    // otro usuario que inicie sesión en la misma pestaña vería la conversación anterior.
    sessionStorage.removeItem('chat_session');
    setToken(null);
    setUser(null);
    router.push('/login');
  }

  return <Ctx.Provider value={{ user, token, login, logout, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
