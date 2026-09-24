'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { C } from '@/lib/colors';
import Navbar from '@/components/Navbar';
import AdminTabs from '@/components/AdminTabs';

interface DocItem {
  _id: string;
  title: string;
  sourceFile: string;
  version: number;
  ingestedAt: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function AdminDocumentsPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/chat');
  }, [user, loading, router]);

  function loadDocs() {
    apiFetch<DocItem[]>('/admin/documents')
      .then(setDocs)
      .catch(console.error)
      .finally(() => setFetching(false));
  }

  useEffect(() => { if (user?.role === 'admin') loadDocs(); }, [user]);

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

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
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
      loadDocs();
      if (fileRef.current) fileRef.current.value = '';
      setFileName('');
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

        {/* Mensaje de estado */}
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

        {/* Tabla de documentos */}
        <div style={{ borderLeft: `5px solid ${C.verde}`, paddingLeft: 14, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.verdeDark, margin: 0 }}>Documentos ingresados</h2>
        </div>

        {docs.length === 0 ? (
          <div style={{ background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, padding: 20, textAlign: 'center', color: C.textoSuave, fontSize: 14 }}>
            No hay documentos ingresados aún.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: `1px solid ${C.grisBorde}`, borderRadius: 4, fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.verdeLight, borderBottom: `2px solid ${C.grisBorde}` }}>
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
      </main>

      <footer style={{ background: C.verdeDark, color: 'white', padding: '12px 24px', fontSize: 12, textAlign: 'center', opacity: 0.9 }}>
        Av. San Martín 4453, Buenos Aires · © {new Date().getFullYear()} FAUBA
      </footer>
    </div>
  );
}
