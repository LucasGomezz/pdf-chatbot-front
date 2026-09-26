'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { streamAsk } from '@/lib/stream-chat';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';
import SourceList from '@/components/SourceList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Source { chunkId: string; heading: string; snippet: string; }
interface Message { role: 'user' | 'assistant'; content: string; sources?: Source[]; }

const SESSION_KEY = 'chat_session';

function saveSession(messages: Message[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
}

function loadSession(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [wsError, setWsError] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const [justFinishedIndex, setJustFinishedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  // Restore session or load from history param
  useEffect(() => {
    if (loading || !user || initializedRef.current) return;
    initializedRef.current = true;

    const resume = searchParams.get('resume');
    if (resume) {
      try {
        const parsed: Message[] = JSON.parse(decodeURIComponent(resume));
        setMessages(parsed);
        saveSession(parsed);
      } catch { /* ignore */ }
      return;
    }

    const saved = loadSession();
    if (saved.length) setMessages(saved);
  }, [loading, user, searchParams]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function sendQuestion() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    setWsError('');
    setLimitMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const next: Message[] = [...messages, { role: 'user', content: q }, { role: 'assistant', content: '' }];
    const assistantIndex = next.length - 1;
    setMessages(next);
    setStreaming(true);
    setJustFinishedIndex(null);

    let assistantMsg = '';

    streamAsk(q, history, {
      onToken: (chunk) => {
        assistantMsg += chunk;
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: assistantMsg };
          saveSession(u);
          return u;
        });
      },
      onDone: (sources) => {
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: assistantMsg, sources };
          saveSession(u);
          return u;
        });
        setStreaming(false);
        setJustFinishedIndex(assistantIndex);
        setTimeout(() => {
          setJustFinishedIndex((cur) => (cur === assistantIndex ? null : cur));
        }, 2500);
      },
      onError: (message) => {
        setWsError(message);
        setStreaming(false);
      },
      onLimit: (message) => {
        setMessages(prev => {
          const u = prev.slice(0, -1);
          saveSession(u);
          return u;
        });
        setLimitMessage(message);
        setStreaming(false);
      },
    }).catch((err) => {
      setWsError(err.message || 'Error de conexión');
      setStreaming(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
  }

  function lauPoseFor(i: number): string {
    const isLast = i === messages.length - 1;
    if (streaming && isLast) return '/lau-thinking.png';
    if (justFinishedIndex === i) return '/lau-excited.png';
    return '/lau-reading.png';
  }

  function newChat() {
    sessionStorage.removeItem(SESSION_KEY);
    setMessages([]);
    setWsError('');
    setLimitMessage('');
  }

  if (loading) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.gris }}>
      <Navbar />

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 8px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>

          {messages.length === 0 && (
            <div style={{ margin: '24px auto 0', maxWidth: 480, textAlign: 'center' }}>
              <img
                src="/lau-reading.png"
                alt="Lau, el asistente virtual"
                style={{ height: 150, width: 'auto', margin: '0 auto 12px', display: 'block' }}
              />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.texto, marginBottom: 10 }}>
                Asistente de Cátedra
              </h2>
              <p style={{ fontSize: 14, color: C.textoSuave, lineHeight: 1.7, marginBottom: 28 }}>
                Consultá sobre el material de estudio.<br />Las respuestas se basan exclusivamente en el contenido subido por los docentes.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['¿Cuál es el tema principal del capítulo 3?', '¿Qué es la agricultura de precisión?', 'Explicame el concepto de nivelación'].map((q) => (
                  <button key={q} onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                    style={{
                      background: '#fff', border: `1px solid ${C.grisBorde}`, borderRadius: 10,
                      padding: '10px 16px', fontSize: 13, color: C.textoMedio, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8dfc0'; e.currentTarget.style.boxShadow = `0 2px 8px ${C.verdeGlow}`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.grisBorde; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                  >
                    <span style={{ marginRight: 8, opacity: 0.5 }}>→</span>{q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={newChat} style={{
                background: 'transparent', border: `1px solid ${C.grisBorde}`,
                borderRadius: 8, padding: '5px 14px', fontSize: 12, color: C.textoSuave,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.verde)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.grisBorde)}
              >
                + Nueva consulta
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 8,
              marginTop: i > 0 && messages[i - 1].role !== msg.role ? 12 : 2,
            }}>
              {msg.role === 'assistant' && (
                <img
                  src={lauPoseFor(i)}
                  alt="Lau"
                  style={{
                    width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center',
                    flexShrink: 0, marginBottom: 2, border: `1px solid ${C.grisBorde}`,
                    opacity: i === messages.length - 1 || messages[i + 1]?.role !== 'assistant' ? 1 : 0,
                    transition: 'opacity 0.2s',
                  }}
                />
              )}

              <div style={{
                maxWidth: '72%',
                background: msg.role === 'user' ? C.verde : '#fff',
                color: msg.role === 'user' ? '#fff' : C.texto,
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px',
                fontSize: 14,
                lineHeight: 1.65,
                boxShadow: C.sombra,
              }}>
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  msg.content ? (
                    <>
                      <div className="md-content" style={{ minWidth: 0 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.sources && <SourceList sources={msg.sources} />}
                    </>
                  ) : streaming ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20, padding: '0 2px' }}>
                      <Dot d={0} /><Dot d={0.2} /><Dot d={0.4} />
                    </span>
                  ) : null
                )}
              </div>

              {msg.role === 'user' && <div style={{ width: 28, flexShrink: 0 }} />}
            </div>
          ))}

          {wsError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', color: '#dc2626', fontSize: 13, margin: '8px 0',
            }}>
              {wsError}
            </div>
          )}

          {limitMessage && (
            <div style={{
              background: '#fdf6e8', border: '1px solid #e8d8a8', borderRadius: 8,
              padding: '10px 14px', color: '#7a5c10', fontSize: 13, margin: '8px 0',
            }}>
              {limitMessage}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ background: '#fff', borderTop: `1px solid ${C.grisBorde}`, padding: '12px 16px', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{
            flex: 1, background: C.gris, borderRadius: 22, border: `1.5px solid transparent`,
            display: 'flex', alignItems: 'flex-end', padding: '8px 16px', transition: 'border-color 0.15s',
          }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = C.verde)}
            onBlurCapture={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu consulta..."
              rows={1}
              disabled={streaming}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, resize: 'none', fontFamily: 'inherit',
                color: C.texto, lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              }}
            />
          </div>

          <button onClick={sendQuestion} disabled={streaming || !input.trim()} title="Enviar"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: streaming || !input.trim() ? C.grisBorde : `linear-gradient(135deg, ${C.verde}, ${C.verdeMid})`,
              border: 'none', cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: streaming || !input.trim() ? 'none' : `0 2px 8px ${C.verdeGlow}`,
              transition: 'all 0.15s',
            }}
          >
            {streaming ? (
              <span style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M2 21L23 12 2 3v7l15 2-15 2v7z" fill="#fff" />
              </svg>
            )}
          </button>
        </div>
        <p style={{ maxWidth: 760, margin: '6px auto 0', fontSize: 11, color: C.textoSuave, textAlign: 'center' }}>
          Las respuestas se basan exclusivamente en el material de cátedra. · <kbd style={{ fontSize: 10, background: '#eee', padding: '1px 4px', borderRadius: 3, border: '1px solid #ccc' }}>Shift+Enter</kbd> para nueva línea
        </p>
      </div>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.verdeMid, display: 'inline-block', animation: `bounce 1.2s ${d}s infinite ease-in-out` }} />;
}
