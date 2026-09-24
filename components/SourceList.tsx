import { C } from '@/lib/colors';

interface Source { chunkId: string; heading: string; snippet: string; }

export default function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.grisBorde}` }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: C.textoSuave, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Fuentes
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sources.map((s) => (
          <span key={s.chunkId} title={s.snippet} style={{
            background: C.verdeLight,
            color: C.verdeDark,
            border: `1px solid #c8dfc0`,
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span style={{ opacity: 0.6, fontSize: 10 }}>📄</span>
            {s.heading || 'Sección sin título'}
          </span>
        ))}
      </div>
    </div>
  );
}
