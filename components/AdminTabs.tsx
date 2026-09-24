'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { C } from '@/lib/colors';

const TABS = [
  { href: '/admin/documents', label: 'Material' },
  { href: '/admin/students', label: 'Alumnos autorizados' },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.grisBorde}` }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            color: active ? C.verdeDark : C.textoSuave,
            borderBottom: active ? `2px solid ${C.verde}` : '2px solid transparent',
            marginBottom: -1,
          }}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
