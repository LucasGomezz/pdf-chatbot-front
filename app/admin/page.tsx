'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';
import AdminTabs, { AdminTab } from '@/components/AdminTabs';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface DocItem {
  _id: string;
  title: string;
  sourceFile: string;
  version: number;
  ingestedAt: string;
}

type LauUploadStatus = 'idle' | 'uploading' | 'success';

export default function AdminPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('documents');
  const [uploadStatus, setUploadStatus] = useState<LauUploadStatus>('idle');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/chat');
  }, [user, loading, router]);

  function reportUpload(status: LauUploadStatus) {
    setUploadStatus(status);
    if (status === 'success') {
      setTimeout(() => setUploadStatus((cur) => (cur === 'success' ? 'idle' : cur)), 2500);
    }
  }

  if (loading || !user || user.role !== 'admin') return null;

  const lauPose = uploadStatus === 'uploading' ? '/lau-thinking.png'
    : uploadStatus === 'success' ? '/lau-success.png'
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
          <div style={{ position: 'relative', marginTop: 10 }}>
            <div style={{
              background: '#fff', border: `1px solid ${C.grisBorde}`, borderRadius: 16,
              padding: '12px 18px', boxShadow: C.sombra, maxWidth: 320,
            }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.texto }}>¡Hola! Soy Lau 👋</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textoMedio }}>¿En qué puedo ayudarte hoy?</p>
            </div>
            <span style={{ position: 'absolute', left: -10, bottom: 6, width: 9, height: 9, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
            <span style={{ position: 'absolute', left: -19, bottom: 0, width: 5, height: 5, borderRadius: '50%', background: '#fff', border: `1px solid ${C.grisBorde}` }} />
          </div>
        </div>

        <AdminTabs active={tab} onChange={setTab} />

        {/* Ambas secciones quedan montadas siempre; se ocultan con CSS para que
            cambiar de pestaña no dispare una recarga de datos ni de navegación. */}
        <div style={{ display: tab === 'documents' ? 'block' : 'none' }}>
          <DocumentsSection token={token} onUploadStatusChange={reportUpload} />
        </div>
        <div style={{ display: tab === 'students' ? 'block' : 'none' }}>
          <StudentsSection token={token} />
        </div>
      </main>

      <footer style={{ background: C.verdeDark, color: 'white', padding: '12px 24px', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
        Av. San Martín 4453, Buenos Aires · © {new Date().getFullYear()} FAUBA
      </footer>
    </div>
  );
}

function DocumentsSection({ token, onUploadStatusChange }: { token: string | null; onUploadStatusChange: (status: LauUploadStatus) => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
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

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    onUploadStatusChange('uploading');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/admin/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setStatus({ msg: 'Archivo subido e ingesta completada correctamente.', ok: true });
      onUploadStatusChange('success');
      loadDocs();
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
      onUploadStatusChange('idle');
    } finally {
      setBusy(false);
    }
  }

  if (fetching) return null;

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
              Procesando el documento — puede tardar hasta varios minutos según el tamaño. No cierres esta pestaña.
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

      {docs.length === 0 ? (
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
                <td style={{ padding: '10px 16px', fontWeight: 600, color: C.texto }}>{doc.title}</td>
                <td style={{ padding: '10px 16px', color: C.textoSuave, fontFamily: 'monospace', fontSize: 12 }}>{doc.sourceFile}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ background: C.verde, color: 'white', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                    v{doc.version}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: C.textoSuave }}>
                  {new Date(doc.ingestedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
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

function StudentsSection({ token }: { token: string | null }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
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
    apiFetch<string[]>('/admin/students')
      .then((list) => { setEmails(list); setSelected(new Set()); })
      .catch(console.error)
      .finally(() => setFetching(false));
  }

  useEffect(() => { loadEmails(); }, []);

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((e) => e.includes(q));
  }, [emails, search]);

  function toggleOne(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filteredEmails.length ? new Set() : new Set(filteredEmails)));
  }

  async function addEmails() {
    const list = addValue.split(/[\r\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await apiFetch<{ added: number; skipped: number }>('/admin/students', {
        method: 'POST',
        body: JSON.stringify({ emails: list }),
      });
      const parts = [`${result.added} agregado(s)`];
      if (result.skipped > 0) parts.push(`${result.skipped} ya estaba(n) o no era(n) válido(s)`);
      setStatus({ msg: parts.join(', ') + '.', ok: true });
      setAddValue('');
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
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
      const result = await res.json();
      const parts = [`${result.added} agregado(s)`];
      if (result.skipped > 0) parts.push(`${result.skipped} ya estaba(n) o no era(n) válido(s)`);
      setStatus({ msg: parts.join(', ') + '.', ok: true });
      loadEmails();
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
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
    if (!confirm(`¿Borrar TODOS los ${emails.length} emails autorizados? Ningún alumno va a poder registrarse ni iniciar sesión hasta que cargues una lista nueva.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch('/admin/students/all', { method: 'DELETE' });
      setStatus({ msg: 'Se borró toda la lista.', ok: true });
      loadEmails();
    } catch (err: any) {
      setStatus({ msg: `Error: ${err.message}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (fetching) return null;

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
            Alumnos autorizados ({emails.length})
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

      {emails.length === 0 ? (
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
          {filteredEmails.map((email, i) => (
            <div key={email} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < filteredEmails.length - 1 ? `1px solid ${C.grisBorde}` : 'none',
            }}>
              {editingEmail === email ? (
                <>
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(email); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{
                      flex: 1, fontSize: 13, fontFamily: 'monospace', padding: '5px 8px',
                      border: `1px solid ${C.verde}`, borderRadius: 4,
                    }}
                  />
                  <button
                    onClick={() => saveEdit(email)} disabled={busy}
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
                  <input type="checkbox" checked={selected.has(email)} onChange={() => toggleOne(email)} />
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: C.texto }}>{email}</span>
                  <button
                    onClick={() => startEdit(email)}
                    title="Editar"
                    style={{ background: 'transparent', border: `1px solid ${C.grisBorde}`, color: C.textoMedio, borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => removeEmail(email)}
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
