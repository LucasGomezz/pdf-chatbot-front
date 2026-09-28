'use client';

import { C } from '@/lib/colors';

export type AdminTab = 'documents' | 'students' | 'teachers';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'documents', label: 'Material' },
  { key: 'students', label: 'Alumnos autorizados' },
  { key: 'teachers', label: 'Docentes de cátedra' },
];

export default function AdminTabs({ active, onChange }: { active: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.grisBorde}` }}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${C.verde}` : '2px solid transparent',
              color: isActive ? C.verdeDark : C.textoSuave,
              marginBottom: -1,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
