'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';
import AdminTabs from '@/components/AdminTabs';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function AdminStudentsPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [emails, setEmails] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [search, setSearch] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/chat');
  }, [user, loading, router]);

  function loadEmails() {
    apiFetch<string[]>('/admin/students')
      .then(setEmails)
      .catch(console.error)
      .finally(() => setFetching(false));
  }

  useEffect(() => { if (user?.role === 'admin') loadEmails(); }, [user]);

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((e) => e.includes(q));
  }, [emails, search]);

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

  if (loading || fetching) return null;

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

        <AdminTabs />

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
      </main>

      <footer style={{ background: C.verdeDark, color: 'white', padding: '12px 24px', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
        Av. San Martín 4453, Buenos Aires · © {new Date().getFullYear()} FAUBA
      </footer>
    </div>
  );
}
