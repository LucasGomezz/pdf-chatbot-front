'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { C } from '@/lib/colors';

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: any }>('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      login(data.token, data.user);
      router.push('/chat');
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.gris }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 20% 50%, ${C.verdeGlow} 0%, transparent 60%),
                     radial-gradient(ellipse at 80% 20%, rgba(90,144,67,0.07) 0%, transparent 50%)`,
      }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/fauba-logo.png" alt="FAUBA" style={{ height: 88, margin: '0 auto 16px', display: 'block' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.texto, marginBottom: 6 }}>
              Asistente Virtual FAUBA
            </h1>
            <p style={{ fontSize: 13, color: C.textoSuave }}>
              Facultad de Agronomía · Universidad de Buenos Aires
            </p>
          </div>

          <div style={{
            background: '#fff', borderRadius: 16,
            boxShadow: C.sombraCard, border: `1px solid ${C.grisBorde}`, overflow: 'hidden',
          }}>
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: C.texto, marginBottom: 24 }}>Crear cuenta</h2>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.textoMedio }}>Correo electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="tu@email.com" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = C.verde)}
                    onBlur={e => (e.target.style.borderColor = C.grisBorde)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.textoMedio }}>
                    Contraseña <span style={{ color: C.textoSuave, fontWeight: 400 }}>(mín. 6 caracteres)</span>
                  </label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    placeholder="••••••••" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = C.verde)}
                    onBlur={e => (e.target.style.borderColor = C.grisBorde)} />
                </div>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, display: 'flex', gap: 8 }}>
                    <span>⚠</span> {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  background: loading ? '#9ca3af' : `linear-gradient(135deg, ${C.verde}, ${C.verdeMid})`,
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '11px 0', fontWeight: 600, fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : `0 2px 12px ${C.verdeGlow}`,
                }}>
                  {loading ? 'Registrando...' : 'Crear cuenta'}
                </button>
              </form>
            </div>

            <div style={{ borderTop: `1px solid ${C.grisBorde}`, padding: '16px 32px', background: C.grisSuave, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: C.textoSuave }}>
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" style={{ color: C.verde, fontWeight: 600, textDecoration: 'none' }}>Iniciá sesión</Link>
              </p>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: C.textoSuave, marginTop: 24 }}>
            Av. San Martín 4453, Buenos Aires
          </p>
        </div>
      </div>
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.grisBorde}`, borderRadius: 8,
  padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  background: '#fff', color: '#111827', transition: 'border-color 0.15s',
};
