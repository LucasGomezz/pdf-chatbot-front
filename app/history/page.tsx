'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';

interface HistoryItem {
  _id: string; question: string; answer: string;
  createdAt: string; sources: { heading: string }[];
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);
  useEffect(() => {
    if (!user) return;
    apiFetch<HistoryItem[]>('/chat/history?limit=30')
      .then(setItems).catch(console.error).finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.gris }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 820, width: '100%', margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.texto, marginBottom: 4 }}>Historial</h1>
          <p style={{ fontSize: 13, color: C.textoSuave }}>Últimas 30 consultas realizadas</p>
        </div>

        {items.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 12, border: `1px solid ${C.grisBorde}`,
            padding: '48px 24px', textAlign: 'center',
            boxShadow: C.sombra,
          }}>
            <img src="/lau-reading.png" alt="Lau" style={{ height: 100, width: 'auto', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 600, color: C.texto, marginBottom: 6 }}>Sin consultas todavía</p>
            <p style={{ fontSize: 13, color: C.textoSuave }}>Tus consultas al asistente aparecerán acá.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, idx) => {
              const isOpen = expanded === item._id;
              const date = new Date(item.createdAt);
              const dateStr = date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

              return (
                <div key={item._id} style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: `1px solid ${isOpen ? '#c8dfc0' : C.grisBorde}`,
                  boxShadow: isOpen ? `0 2px 12px ${C.verdeGlow}` : C.sombra,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : item._id)}
                    style={{
                      width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    }}
                  >
                    {/* Number badge */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: isOpen ? C.verde : C.verdeLight,
                      color: isOpen ? '#fff' : C.verdeDark,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {items.length - idx}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: C.texto, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.question}
                      </p>
                      <p style={{ fontSize: 12, color: C.textoSuave }}>{dateStr}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <Link
                        href={`/chat?resume=${encodeURIComponent(item._id)}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 11, fontWeight: 500, color: C.verde,
                          border: `1px solid #c8dfc0`, borderRadius: 6,
                          padding: '2px 10px', textDecoration: 'none',
                          background: C.verdeLight,
                        }}
                      >
                        Retomar
                      </Link>
                      <span style={{
                        color: isOpen ? C.verde : C.textoSuave,
                        fontSize: 12,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}>▼</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.grisBorde}` }}>
                      <p style={{ fontSize: 13, color: C.textoMedio, whiteSpace: 'pre-wrap', marginTop: 16, lineHeight: 1.75 }}>
                        {item.answer}
                      </p>
                      {item.sources?.length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.sources.map((s, i) => (
                            <span key={i} style={{
                              background: C.verdeLight, color: C.verdeDark,
                              border: '1px solid #c8dfc0', borderRadius: 20,
                              padding: '3px 12px', fontSize: 11, fontWeight: 500,
                            }}>
                              📄 {s.heading || 'Sección sin título'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${C.grisBorde}`, padding: '16px 24px', textAlign: 'center', fontSize: 12, color: C.textoSuave, background: '#fff' }}>
        Av. San Martín 4453, Buenos Aires · © {new Date().getFullYear()} FAUBA
      </footer>
    </div>
  );
}
