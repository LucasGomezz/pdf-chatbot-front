'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { extractPdfText } from '@/lib/pdf-text';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';
import AdminTabs, { AdminTab } from '@/components/AdminTabs';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
// Duración mínima de la pose "pensando" en las acciones de alumnos, que suelen
// ser casi instantáneas — así se alcanza a notar el cambio de animación.
const MIN_ACTION_MS = 900;
// Vercel corta los requests de más de ~4.5 MB; se deja margen.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Reintentos seguidos ante errores de red antes de dejar el documento como incompleto.
const MAX_PROCESS_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withMinDelay<T>(promise: Promise<T>, start: number, min: number): Promise<T> {
  return promise.then((result) => {
    const remaining = Math.max(0, min - (Date.now() - start));
    return new Promise((resolve) => setTimeout(() => resolve(result), remaining));
  });
}

interface DocItem {
  _id: string;
  title: string;
  sourceFile: string;
  version: number;
  ingestedAt: string;
  status?: 'processing' | 'ready';
  totalChunks?: number;
  processedChunks?: number;
}

interface IngestProgress {
  id: string;
  status: 'processing' | 'ready';
  processed: number;
  total: number;
  retryAfterMs?: number;
}

function LoadingBox({ text }: { text: string }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
      {text}
    </div>
  );
}

async function postMultipart<T>(path: string, form: FormData, token: string | null): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export type LauStatus = 'idle' | 'busy' | 'success';

export default function AdminPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('documents');
  const [lauStatus, setLauStatus] = useState<LauStatus>('idle');
  const [hasInteracted, setHasInteracted] = useState(false);
  // La lista de autorizados vive acá y se reparte entre las pestañas de alumnos y
  // docentes, así promover o quitar a alguien se refleja en ambas sin recargar.
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/chat');
  }, [user, loading, router]);

  function loadEntries() {
    return apiFetch<StudentEntry[]>('/admin/students')
      .then(setEntries)
      .catch(console.error)
      .finally(() => setEntriesLoaded(true));
  }

  useEffect(() => {
    if (!loading && user?.role === 'admin') loadEntries();
  }, [loading, user]);

  const students = useMemo(() => entries.filter((e) => !e.isAdmin), [entries]);
  const teachers = useMemo(() => entries.filter((e) => e.isAdmin), [entries]);

  function reportActivity(status: LauStatus) {
    setLauStatus(status);
    if (status === 'busy') setHasInteracted(true);
    if (status === 'success') {
      setTimeout(() => setLauStatus((cur) => (cur === 'success' ? 'idle' : cur)), 2500);
    }
  }

  if (loading || !user || user.role !== 'admin') return null;

  const lauPose = lauStatus === 'busy' ? '/lau-thinking.png'
    : lauStatus === 'success' ? '/lau-success.png'
    : '/lau-folder.png';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, maxWidth: 860, width: '100%', margin: '0 auto', padding: '28px 16px' }}>

        <div style={{ borderLeft: `5px solid ${C.verde}`, paddingLeft: 14, marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.verdeDark, margin: 0 }}>
            Administración de Material
          </h1>
          <p style={{ fontSize: 13, color: C.textoSuave, margin: '4px 0 0' }}>
            Gestioná el contenido disponible para el asistente virtual
          </p>
        </div>

        {/* Lau saludando al profe/admin */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          <img
            src={lauPose}
            alt="Lau"
            style={{ height: 130, width: 'auto', flexShrink: 0, transition: 'opacity 0.15s' }}
          />
          {lauStatus === 'idle' && (
            <div style={{ position: 'relative', marginTop: 10 }}>
              <div style={{
                background: '#fff', border: `1px solid ${C.grisBorde}`, borderRadius: 16,
                padding: '12px 18px', boxShadow: C.sombra, maxWidth: 320,
              }}>
                {hasInteracted ? (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.texto }}>¿En qué seguimos? 🙂</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textoMedio }}>Contame si necesitás algo más.</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.texto }}>¡Hola! Soy Lau 👋</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textoMedio }}>¿En qué puedo ayudarte hoy?</p>
                  </>
                )}
              </div>
              <span style={{ position: 'absolute', left: -10, bottom: 6, width: 9, height: 9, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
              <span style={{ position: 'absolute', left: -19, bottom: 0, width: 5, height: 5, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
            </div>
          )}
        </div>

        <AdminTabs active={tab} onChange={setTab} />

        {/* Ambas secciones quedan montadas siempre; se ocultan con CSS para que
            cambiar de pestaña no dispare una recarga de datos ni de navegación. */}
        <div style={{ display: tab === 'documents' ? 'block' : 'none' }}>
          <DocumentsSection token={token} onActivity={reportActivity} />
        </div>
        <div style={{ display: tab === 'students' ? 'block' : 'none' }}>
          <StudentsSection token={token} onActivity={reportActivity} emails={students} loaded={entriesLoaded} reload={loadEntries} />
        </div>
        <div style={{ display: tab === 'teachers' ? 'block' : 'none' }}>
          <TeachersSection onActivity={reportActivity} teachers={teachers} loaded={entriesLoaded} reload={loadEntries} />
        </div>
      </main>

      <footer style={{ background: C.verdeDark, color: 'white', padding: '12px 24px', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
        Av. San Martín 4453, Buenos Aires · © {new Date().getFullYear()} FAUBA
      </footer>
    </div>
  );
}

function DocumentsSection({ token, onActivity }: { token: string | null; onActivity: (status: LauStatus) => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  function loadDocs() {
    apiFetch<DocItem[]>('/admin/documents')
      .then((list) => { setDocs(list); setSelected(new Set()); })
      .catch(console.error)
      .finally(() => setFetching(false));
  }

  useEffect(() => { loadDocs(); }, []);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === docs.length ? new Set() : new Set(docs.map((d) => d._id))));
  }

  async function deleteDoc(doc: DocItem) {
    if (!confirm(`¿Borrar "${doc.title}" (${doc.sourceFile})? Esto borra también sus fragmentos indexados.`)) return;
    setStatus(null);
    try {
      await apiFetch(`/admin/documents/${doc._id}`, { method: 'DELETE' });
      setStatus({ msg: `"${doc.title}" eliminado.`, ok: true });
      loadDocs();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`¿Borrar ${selected.size} documento(s) seleccionado(s)? Esto borra también sus fragmentos indexados.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      await Promise.all([...selected].map((id) => apiFetch(`/admin/documents/${id}`, { method: 'DELETE' })));
      setStatus({ msg: `${selected.size} documento(s) eliminado(s).`, ok: true });
      loadDocs();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  // Sube el archivo (o el texto del PDF) y crea el documento en estado "en proceso".
  async function startUpload(file: File): Promise<IngestProgress> {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setProgress('Leyendo el PDF...');
      let text: string | null = null;
      try {
        text = await extractPdfText(file);
      } catch (err) {
        console.error('No se pudo extraer el texto en el navegador', err);
      }
      if (text !== null) {
        if (!text.trim()) {
          throw new Error('El PDF no tiene texto seleccionable. Si es un escaneo (imágenes), hace falta pasarlo por OCR antes de subirlo.');
        }
        const body = JSON.stringify({ fileName: file.name, text });
        if (new Blob([body]).size > MAX_UPLOAD_BYTES) {
          throw new Error('El texto del PDF es demasiado largo para subirlo de una vez. Dividilo en partes más chicas.');
        }
        setProgress('Subiendo el texto...');
        return apiFetch<IngestProgress>('/admin/documents/upload-text', { method: 'POST', body });
      }
      // Si falló la lectura en el navegador, se manda el PDF entero y lo procesa el backend.
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 4 MB.`);
    }
    setProgress('Subiendo el archivo...');
    const form = new FormData();
    form.append('file', file);
    return postMultipart<IngestProgress>('/admin/documents/upload', form, token);
  }

  // Pide al backend que siga procesando por tandas hasta terminar. Si hay que
  // esperar por el límite de la API de embeddings, espera y sigue solo.
  async function processUntilReady(initial: IngestProgress): Promise<void> {
    let current = initial;
    let failures = 0;
    while (current.status !== 'ready') {
      setProgress(`Procesando fragmentos: ${current.processed} de ${current.total}`);
      if (current.retryAfterMs) {
        setProgress(`Procesando fragmentos: ${current.processed} de ${current.total} — esperando ${Math.ceil(current.retryAfterMs / 1000)} s por el límite de la API...`);
        await sleep(current.retryAfterMs);
      }
      try {
        current = await apiFetch<IngestProgress>(`/admin/documents/${current.id}/process`, { method: 'POST' });
        failures = 0;
      } catch (err) {
        failures++;
        if (failures >= MAX_PROCESS_RETRIES) throw err;
        await sleep(3000);
      }
    }
  }

  async function runIngest(start: () => Promise<IngestProgress>) {
    setBusy(true);
    setStatus(null);
    onActivity('busy');
    try {
      const initial = await start();
      await processUntilReady(initial);
      setStatus({ msg: 'Archivo subido e ingesta completada correctamente.', ok: true });
      onActivity('success');
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
    } catch (err: any) {
      setStatus({
        msg: `Error: ${err.message}. Si el documento quedó como "Incompleto" en la lista, podés reanudarlo; mientras tanto el asistente sigue usando la versión anterior.`,
        ok: false,
      });
      onActivity('idle');
    } finally {
      setProgress('');
      setBusy(false);
      loadDocs();
    }
  }

  function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    runIngest(() => startUpload(file));
  }

  function resumeDoc(doc: DocItem) {
    runIngest(() => apiFetch<IngestProgress>(`/admin/documents/${doc._id}/process`, { method: 'POST' }));
  }

  return (
    <>
      {/* Subir archivo */}
      <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ background: C.verdeLight, borderBottom: `1px solid ${C.grisBorde}`, padding: '12px 18px' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.verdeDark, margin: 0 }}>Subir material</p>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ fontSize: 13, color: C.textoSuave, marginBottom: 14 }}>
            Aceptá archivos <code style={{ background: C.gris, padding: '1px 5px', borderRadius: 3 }}>.pdf</code>, <code style={{ background: C.gris, padding: '1px 5px', borderRadius: 3 }}>.md</code> o <code style={{ background: C.gris, padding: '1px 5px', borderRadius: 3 }}>.txt</code>. Cada archivo queda como un documento aparte — volver a subir uno con el mismo nombre solo actualiza ese documento, sin afectar a los demás.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.md,.txt"
            disabled={busy}
            onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{
                background: '#fff', border: `1.5px solid ${C.verde}`, color: C.verde,
                borderRadius: 4, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              Elegir archivo
            </button>
            <span style={{
              fontSize: 13, color: fileName ? C.texto : C.textoSuave, flex: 1, minWidth: 120,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {fileName || 'Ningún archivo seleccionado'}
            </span>
            <button
              onClick={uploadFile} disabled={busy || !fileName}
              style={{
                background: (busy || !fileName) ? C.grisBorde : C.verdeDark, color: 'white', border: 'none',
                borderRadius: 4, padding: '9px 18px', fontWeight: 600, fontSize: 13,
                cursor: (busy || !fileName) ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              {busy ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
          {busy && (
            <p style={{ fontSize: 12, color: C.textoSuave, marginTop: 10, fontStyle: 'italic' }}>
              {progress && <strong style={{ fontStyle: 'normal', color: C.verdeDark }}>{progress}. </strong>}
              Puede tardar varios minutos según el tamaño. No cierres esta pestaña; si se corta, el documento queda como &quot;Incompleto&quot; y lo podés reanudar.
            </p>
          )}
        </div>
      </div>

      {status && (
        <div style={{
          background: status.ok ? '#f0f8ee' : '#fdf0f0',
          border: `1px solid ${status.ok ? '#b8d4b0' : '#e8c0c0'}`,
          borderLeft: `4px solid ${status.ok ? C.verde : '#c0392b'}`,
          borderRadius: 4, padding: '10px 16px', marginBottom: 24,
          fontSize: 13, color: status.ok ? C.verdeDark : '#c0392b',
        }}>
          {status.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ borderLeft: `5px solid ${C.verde}`, paddingLeft: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.verdeDark, margin: 0 }}>Documentos ingresados</h2>
        </div>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected} disabled={busy}
            style={{
              background: 'transparent', border: '1px solid #e8c0c0', color: '#c0392b',
              borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            Borrar seleccionados ({selected.size})
          </button>
        )}
      </div>

      {fetching ? (
        <LoadingBox text="Cargando documentos..." />
      ) : docs.length === 0 ? (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
          No hay documentos ingresados aún.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.verdeLight, borderBottom: `2px solid ${C.grisBorde}` }}>
              <th style={{ padding: '10px 12px', width: 28 }}>
                <input type="checkbox" checked={selected.size === docs.length} onChange={toggleAll} />
              </th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, color: C.verdeDark }}>Título</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, color: C.verdeDark }}>Archivo</th>
              <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: 700, color: C.verdeDark }}>Versión</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, color: C.verdeDark }}>Ingresado</th>
              <th style={{ padding: '10px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <tr key={doc._id} style={{ borderBottom: i < docs.length - 1 ? `1px solid ${C.grisBorde}` : 'none' }}>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(doc._id)} onChange={() => toggleOne(doc._id)} />
                </td>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: C.texto }}>
                  {doc.title}
                  {doc.status === 'processing' && (
                    <span
                      title="No se usa en el chat hasta terminar de procesarse"
                      style={{ marginLeft: 8, background: '#fdf6e8', color: '#7a5c10', border: '1px solid #e8d8a8', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}
                    >
                      INCOMPLETO {doc.processedChunks ?? 0}/{doc.totalChunks ?? 0}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', color: C.textoSuave, fontFamily: 'monospace', fontSize: 12 }}>{doc.sourceFile}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ background: C.verde, color: 'white', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                    v{doc.version}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: C.textoSuave }}>
                  {new Date(doc.ingestedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {doc.status === 'processing' && (
                    <button
                      onClick={() => resumeDoc(doc)} disabled={busy}
                      title="Seguir procesando desde donde quedó"
                      style={{
                        background: 'transparent', border: '1px solid #c8dfc0', borderRadius: 4, marginRight: 6,
                        color: C.verdeDark, fontSize: 12, padding: '4px 8px', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Reanudar
                    </button>
                  )}
                  <button
                    onClick={() => deleteDoc(doc)}
                    title="Borrar documento"
                    style={{
                      background: 'transparent', border: `1px solid ${C.grisBorde}`, borderRadius: 4,
                      color: '#c0392b', fontSize: 12, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

interface StudentEntry {
  email: string;
  isAdmin: boolean;
}

interface EntriesProps {
  loaded: boolean;
  reload: () => Promise<void>;
}

function StudentsSection({ token, onActivity, emails, loaded, reload }: EntriesProps & {
  token: string | null;
  onActivity: (status: LauStatus) => void;
  emails: StudentEntry[];
}) {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [search, setSearch] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  function loadEmails() {
    reload().then(() => setSelected(new Set()));
  }

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((e) => e.email.includes(q));
  }, [emails, search]);

  function toggleOne(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filteredEmails.length ? new Set() : new Set(filteredEmails.map((e) => e.email))));
  }

  async function addEmails() {
    const list = addValue.split(/[\r\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setStatus(null);
    onActivity('busy');
    const start = Date.now();
    try {
      const result = await withMinDelay(
        apiFetch<{ added: number; skipped: number }>('/admin/students', {
          method: 'POST',
          body: JSON.stringify({ emails: list }),
        }),
        start, MIN_ACTION_MS,
      );
      const parts = [`${result.added} agregado(s)`];
      if (result.skipped > 0) parts.push(`${result.skipped} ya estaba(n) o no era(n) válido(s)`);
      setStatus({ msg: parts.join(', ') + '.', ok: true });
      onActivity('success');
      setAddValue('');
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
      onActivity('idle');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    onActivity('busy');
    const start = Date.now();
    try {
      const result = await withMinDelay((async () => {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${BASE}/admin/students/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `HTTP ${res.status}`);
        }
        return res.json();
      })(), start, MIN_ACTION_MS);
      const parts = [`${result.added} agregado(s)`];
      if (result.skipped > 0) parts.push(`${result.skipped} ya estaba(n) o no era(n) válido(s)`);
      setStatus({ msg: parts.join(', ') + '.', ok: true });
      onActivity('success');
      loadEmails();
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
      onActivity('idle');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(email: string) {
    setEditingEmail(email);
    setEditValue(email);
    setStatus(null);
  }

  function cancelEdit() {
    setEditingEmail(null);
    setEditValue('');
  }

  async function saveEdit(oldEmail: string) {
    const newEmail = editValue.trim().toLowerCase();
    if (!newEmail || newEmail === oldEmail) { cancelEdit(); return; }
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch(`/admin/students/${encodeURIComponent(oldEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify({ newEmail }),
      });
      setStatus({ msg: `Actualizado a ${newEmail}.`, ok: true });
      cancelEdit();
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function removeEmail(email: string) {
    if (!confirm(`¿Sacar a ${email} de la lista de autorizados?`)) return;
    setStatus(null);
    try {
      await apiFetch(`/admin/students/${encodeURIComponent(email)}`, { method: 'DELETE' });
      setStatus({ msg: `${email} eliminado de la lista.`, ok: true });
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    }
  }

  async function promoteEmail(email: string, makeAdmin: boolean) {
    if (!confirm(`¿Nombrar a ${email} docente de la cátedra? Va a poder cargar material y gestionar alumnos, y pasa a la pestaña "Docentes de cátedra".`)) return;
    setStatus(null);
    try {
      await apiFetch(`/admin/students/${encodeURIComponent(email)}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdmin: makeAdmin }),
      });
      setStatus({ msg: `${email} ahora es docente de la cátedra.`, ok: true });
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`¿Sacar a ${selected.size} alumno(s) seleccionado(s) de la lista de autorizados?`)) return;
    setBusy(true);
    setStatus(null);
    try {
      await Promise.all([...selected].map((email) => apiFetch(`/admin/students/${encodeURIComponent(email)}`, { method: 'DELETE' })));
      setStatus({ msg: `${selected.size} alumno(s) eliminado(s).`, ok: true });
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm(`¿Borrar TODOS los ${emails.length} alumnos autorizados? Ningún alumno va a poder registrarse ni iniciar sesión hasta que cargues una lista nueva. Los docentes no se ven afectados.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch('/admin/students/all', { method: 'DELETE' });
      setStatus({ msg: 'Se borró toda la lista de alumnos.', ok: true });
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Agregar alumnos */}
      <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ background: C.verdeLight, borderBottom: `1px solid ${C.grisBorde}`, padding: '12px 18px' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.verdeDark, margin: 0 }}>Agregar alumnos</p>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ fontSize: 13, color: C.textoSuave, marginBottom: 10 }}>
            Pegá uno o más emails (uno por línea o separados por coma) y agregalos a la lista — no borra a los que ya están.
          </p>
          <textarea
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            rows={4}
            placeholder={'alumno1@catedra.edu.ar\nalumno2@catedra.edu.ar'}
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 12, fontFamily: 'monospace',
              border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 10, resize: 'vertical', marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <button
              onClick={addEmails} disabled={busy || !addValue.trim()}
              style={{ background: (busy || !addValue.trim()) ? C.grisBorde : C.verde, color: 'white', border: 'none', borderRadius: 4, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: (busy || !addValue.trim()) ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Agregando...' : 'Agregar'}
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${C.grisBorde}`, paddingTop: 14 }}>
            <p style={{ fontSize: 13, color: C.textoSuave, marginBottom: 10 }}>
              O subí un archivo <code style={{ background: C.gris, padding: '1px 5px', borderRadius: 3 }}>.csv</code> o <code style={{ background: C.gris, padding: '1px 5px', borderRadius: 3 }}>.txt</code> — también suma a la lista, no la reemplaza.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              disabled={busy}
              onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={{
                  background: '#fff', border: `1.5px solid ${C.verde}`, color: C.verde,
                  borderRadius: 4, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0,
                }}
              >
                Elegir archivo
              </button>
              <span style={{
                fontSize: 13, color: fileName ? C.texto : C.textoSuave, flex: 1, minWidth: 120,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fileName || 'Ningún archivo seleccionado'}
              </span>
              <button
                onClick={uploadFile} disabled={busy || !fileName}
                style={{
                  background: (busy || !fileName) ? C.grisBorde : C.verdeDark, color: 'white', border: 'none',
                  borderRadius: 4, padding: '9px 18px', fontWeight: 600, fontSize: 13,
                  cursor: (busy || !fileName) ? 'not-allowed' : 'pointer', flexShrink: 0,
                }}
              >
                Subir
              </button>
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div style={{
          background: status.ok ? '#f0f8ee' : '#fdf0f0',
          border: `1px solid ${status.ok ? '#b8d4b0' : '#e8c0c0'}`,
          borderLeft: `4px solid ${status.ok ? C.verde : '#c0392b'}`,
          borderRadius: 4, padding: '10px 16px', marginBottom: 24,
          fontSize: 13, color: status.ok ? C.verdeDark : '#c0392b',
        }}>
          {status.msg}
        </div>
      )}

      {/* Lista actual */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ borderLeft: `5px solid ${C.verde}`, paddingLeft: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.verdeDark, margin: 0 }}>
            Alumnos autorizados ({loaded ? emails.length : '…'})
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected} disabled={busy}
              style={{
                background: 'transparent', border: '1px solid #e8c0c0', color: '#c0392b',
                borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              Borrar seleccionados ({selected.size})
            </button>
          )}
          {emails.length > 0 && (
            <button
              onClick={clearAll} disabled={busy}
              style={{
                background: 'transparent', border: '1px solid #e8c0c0', color: '#c0392b',
                borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              Borrar todos
            </button>
          )}
        </div>
      </div>

      {emails.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar email..."
          style={{
            width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 12px',
            border: `1px solid ${C.grisBorde}`, borderRadius: 4, marginBottom: 12,
          }}
        />
      )}

      {!loaded ? (
        <LoadingBox text="Cargando alumnos..." />
      ) : emails.length === 0 ? (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
          No hay ningún email autorizado todavía. Los alumnos no van a poder registrarse hasta que agregues alguno.
        </div>
      ) : filteredEmails.length === 0 ? (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
          Ningún email coincide con "{search}".
        </div>
      ) : (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
            borderBottom: `1px solid ${C.grisBorde}`, background: C.verdeLight,
          }}>
            <input type="checkbox" checked={selected.size === filteredEmails.length} onChange={toggleAll} />
            <span style={{ fontSize: 12, color: C.verdeDark, fontWeight: 600 }}>Seleccionar todos</span>
          </div>
          {filteredEmails.map((entry, i) => (
            <div key={entry.email} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < filteredEmails.length - 1 ? `1px solid ${C.grisBorde}` : 'none',
            }}>
              {editingEmail === entry.email ? (
                <>
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(entry.email); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{
                      flex: 1, fontSize: 13, fontFamily: 'monospace', padding: '5px 8px',
                      border: `1px solid ${C.verde}`, borderRadius: 4,
                    }}
                  />
                  <button
                    onClick={() => saveEdit(entry.email)} disabled={busy}
                    style={{ background: C.verde, color: 'white', border: 'none', borderRadius: 4, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Guardar
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ background: 'transparent', border: `1px solid ${C.grisBorde}`, color: C.textoSuave, borderRadius: 4, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <input type="checkbox" checked={selected.has(entry.email)} onChange={() => toggleOne(entry.email)} />
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: C.texto }}>{entry.email}</span>
                  {isSuperAdmin && (
                    <button
                      onClick={() => promoteEmail(entry.email, true)}
                      title="Nombrar docente de la cátedra"
                      style={{
                        background: 'transparent', border: '1px solid #c8dfc0', color: C.verdeDark,
                        borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Hacer docente
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(entry.email)}
                    title="Editar"
                    style={{ background: 'transparent', border: `1px solid ${C.grisBorde}`, color: C.textoMedio, borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => removeEmail(entry.email)}
                    title="Sacar de la lista"
                    style={{ background: 'transparent', border: '1px solid #e8c0c0', color: '#c0392b', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Borrar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TeachersSection({ onActivity, teachers, loaded, reload }: EntriesProps & {
  onActivity: (status: LauStatus) => void;
  teachers: StudentEntry[];
}) {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addValue, setAddValue] = useState('');

  async function addTeachers() {
    const list = addValue.split(/[\r\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setStatus(null);
    onActivity('busy');
    const start = Date.now();
    try {
      const result = await withMinDelay(
        apiFetch<{ added: number; promoted: number }>('/admin/students/teachers', {
          method: 'POST',
          body: JSON.stringify({ emails: list }),
        }),
        start, MIN_ACTION_MS,
      );
      const parts = [`${result.added} docente(s) agregado(s)`];
      if (result.promoted > 0) parts.push(`${result.promoted} alumno(s) pasaron a docente`);
      setStatus({ msg: parts.join(', ') + '.', ok: true });
      onActivity('success');
      setAddValue('');
      reload();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
      onActivity('idle');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(email: string) {
    if (!confirm(`¿Quitarle los permisos de docente a ${email}? Deja de poder cargar material y gestionar alumnos, y vuelve a la lista de alumnos.`)) return;
    setStatus(null);
    try {
      await apiFetch(`/admin/students/${encodeURIComponent(email)}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdmin: false }),
      });
      setStatus({ msg: `${email} ya no es docente.`, ok: true });
      reload();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    }
  }

  async function remove(email: string) {
    if (!confirm(`¿Sacar a ${email} de la cátedra? Pierde el acceso a la plataforma por completo.`)) return;
    setStatus(null);
    try {
      await apiFetch(`/admin/students/${encodeURIComponent(email)}`, { method: 'DELETE' });
      setStatus({ msg: `${email} eliminado.`, ok: true });
      reload();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    }
  }

  return (
    <>
      {isSuperAdmin && (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ background: C.verdeLight, borderBottom: `1px solid ${C.grisBorde}`, padding: '12px 18px' }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: C.verdeDark, margin: 0 }}>Agregar docentes</p>
          </div>
          <div style={{ padding: 18 }}>
            <p style={{ fontSize: 13, color: C.textoSuave, marginBottom: 10 }}>
              Los docentes son los únicos que pueden cargar material y gestionar la lista de alumnos. Pegá uno o más emails (uno por línea o separados por coma); si alguno ya era alumno, pasa a ser docente.
            </p>
            <textarea
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              rows={3}
              placeholder={'docente1@catedra.edu.ar\ndocente2@catedra.edu.ar'}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 12, fontFamily: 'monospace',
                border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 10, resize: 'vertical', marginBottom: 12,
              }}
            />
            <button
              onClick={addTeachers} disabled={busy || !addValue.trim()}
              style={{ background: (busy || !addValue.trim()) ? C.grisBorde : C.verde, color: 'white', border: 'none', borderRadius: 4, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: (busy || !addValue.trim()) ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Agregando...' : 'Agregar docentes'}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div style={{
          background: status.ok ? '#f0f8ee' : '#fdf0f0',
          border: `1px solid ${status.ok ? '#b8d4b0' : '#e8c0c0'}`,
          borderLeft: `4px solid ${status.ok ? C.verde : '#c0392b'}`,
          borderRadius: 4, padding: '10px 16px', marginBottom: 24,
          fontSize: 13, color: status.ok ? C.verdeDark : '#c0392b',
        }}>
          {status.msg}
        </div>
      )}

      <div style={{ borderLeft: `5px solid ${C.verde}`, paddingLeft: 14, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.verdeDark, margin: 0 }}>
          Docentes de cátedra ({loaded ? teachers.length : '…'})
        </h2>
        {!isSuperAdmin && (
          <p style={{ fontSize: 12, color: C.textoSuave, margin: '4px 0 0' }}>
            Solo el administrador general puede agregar o quitar docentes.
          </p>
        )}
      </div>

      {!loaded ? (
        <LoadingBox text="Cargando docentes..." />
      ) : teachers.length === 0 ? (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
          Todavía no hay docentes asignados.
        </div>
      ) : (
        <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, overflow: 'hidden' }}>
          {teachers.map((entry, i) => (
            <div key={entry.email} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap',
              borderBottom: i < teachers.length - 1 ? `1px solid ${C.grisBorde}` : 'none',
            }}>
              <span style={{ flex: 1, minWidth: 160, fontSize: 13, fontFamily: 'monospace', color: C.texto, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.email}
              </span>
              <span style={{ background: C.verdeLight, color: C.verdeDark, borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                DOCENTE
              </span>
              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => revoke(entry.email)}
                    title="Quitar permisos de docente"
                    style={{ background: 'transparent', border: `1px solid ${C.grisBorde}`, color: C.textoMedio, borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Quitar permisos
                  </button>
                  <button
                    onClick={() => remove(entry.email)}
                    title="Sacar de la cátedra"
                    style={{ background: 'transparent', border: '1px solid #e8c0c0', color: '#c0392b', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Borrar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
