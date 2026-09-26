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
// Duración mínima de la pose "pensando", para que el cambio de animación se
// note aunque el modelo responda muy rápido.
const MIN_THINKING_MS = 900;

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
  const [limitReason, setLimitReason] = useState<'user' | 'global' | undefined>(undefined);
  const [justFinished, setJustFinished] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);
  const askStartRef = useRef(0);

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
    setLimitReason(undefined);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const next: Message[] = [...messages, { role: 'user', content: q }, { role: 'assistant', content: '' }];
    setMessages(next);
    setStreaming(true);
    setJustFinished(false);
    askStartRef.current = Date.now();

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
        const elapsed = Date.now() - askStartRef.current;
        const remaining = Math.max(0, MIN_THINKING_MS - elapsed);
        setTimeout(() => {
          setMessages(prev => {
            const u = [...prev];
            u[u.length - 1] = { role: 'assistant', content: assistantMsg, sources };
            saveSession(u);
            return u;
          });
          setStreaming(false);
          setJustFinished(true);
          setTimeout(() => setJustFinished(false), 2500);
        }, remaining);
      },
      onError: (message) => {
        setWsError(message);
        setStreaming(false);
      },
      onLimit: (message, reason) => {
        setMessages(prev => {
          const u = prev.slice(0, -1);
          saveSession(u);
          return u;
        });
        setLimitMessage(message);
        setLimitReason(reason);
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

  const lauPose = limitMessage
    ? '/lau-limit.png'
    : streaming
    ? '/lau-thinking.png'
    : justFinished
    ? '/lau-excited.png'
    : messages.length === 0
    ? '/lau-folder.png'
    : '/lau-reading.png';

  function newChat() {
    sessionStorage.removeItem(SESSION_KEY);
    setMessages([]);
    setWsError('');
    setLimitMessage('');
    setLimitReason(undefined);
  }

  if (loading) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.gris }}>
      <Navbar />

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 8px' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Lau, personaje fijo a la izquierda mientras dura la conversación */}
          <div className="lau-companion" style={{
            position: 'sticky', top: 0, flexShrink: 0, width: 190,
            flexDirection: 'column', alignItems: 'center', paddingTop: 4,
          }}>
            <img
              src={lauPose}
              alt="Lau, el asistente virtual"
              style={{ height: 190, width: 'auto', transition: 'opacity 0.15s' }}
            />
            {limitMessage ? (
              <div style={{ position: 'relative', marginTop: 14 }}>
                <div style={{
                  background: '#fdf6e8', border: '1px solid #e8d8a8', borderRadius: 14,
                  padding: '10px 14px', boxShadow: C.sombra, maxWidth: 180, textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#7a5c10' }}>
                    {limitReason === 'user' ? 'Sin consultas por hoy' : 'Límite del día alcanzado'}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#8a6d20' }}>
                    {limitReason === 'user' ? 'Podemos seguir mañana' : 'Volvé más tarde'}
                  </p>
                </div>
                <span style={{ position: 'absolute', left: '50%', top: -6, width: 8, height: 8, borderRadius: '50%', background: '#fdf6e8', border: '1px solid #e8d8a8', transform: 'translateX(-50%)' }} />
              </div>
            ) : messages.length > 0 && !streaming && !justFinished && (
              <div style={{ position: 'relative', marginTop: 14 }}>
                <div style={{
                  background: '#fff', border: `1px solid ${C.grisBorde}`, borderRadius: 14,
                  padding: '10px 14px', boxShadow: C.sombra, maxWidth: 180, textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.texto }}>¿Alguna otra duda?</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textoMedio }}>Preguntame lo que quieras 🙂</p>
                </div>
                <span style={{ position: 'absolute', left: '50%', top: -6, width: 8, height: 8, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}`, transform: 'translateX(-50%)' }} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>

          {messages.length === 0 && (
            <div style={{ margin: '12px 0 0', maxWidth: 480 }}>
              {/* Globo de diálogo, con una nube de puntitos hacia Lau */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                <div style={{
                  background: '#fff', border: `1px solid ${C.grisBorde}`, borderRadius: 18,
                  padding: '14px 20px', boxShadow: C.sombra,
                }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.texto }}>¡Hola! Soy Lau 👋</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: C.textoMedio }}>¿En qué puedo ayudarte hoy?</p>
                </div>
                <span style={{ position: 'absolute', left: -12, bottom: 8, width: 10, height: 10, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
                <span style={{ position: 'absolute', left: -22, bottom: 1, width: 6, height: 6, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
              </div>

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
              background: '#fdf6e8', border: '1px solid #e8d8a8', borderRadius: 12,
              padding: '14px 18px', margin: '8px 0',
              boxShadow: C.sombra,
            }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#7a5c10' }}>
                {limitReason === 'user' ? '¡Te quedaste sin consultas por hoy!' : 'El asistente llegó a su límite de uso por hoy'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8a6d20' }}>
                {limitReason === 'user'
                  ? 'Podés pedirle a algún compañero que te ayude, o volvé a probar mañana.'
                  : limitMessage}
              </p>
            </div>
          )}
          <div ref={bottomRef} />
          </div>
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
