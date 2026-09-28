'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, AUTH_EXPIRED_EVENT } from './api';

interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  isSuperAdmin?: boolean;
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
      // El usuario guardado puede estar desactualizado (p. ej. lo nombraron docente
      // o le quitaron los permisos): se refresca el rol contra el servidor.
      apiFetch<{ role: AuthUser['role']; isSuperAdmin?: boolean }>('/auth/me')
        .then((me) => {
          setUser((prev) => {
            if (!prev) return prev;
            const next = { ...prev, role: me.role, isSuperAdmin: me.isSuperAdmin };
            localStorage.setItem('user', JSON.stringify(next));
            return next;
          });
        })
        .catch(() => { /* un 401 ya dispara el cierre de sesión */ });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  });

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
