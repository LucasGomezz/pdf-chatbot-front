'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { C } from '@/lib/colors';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header style={{
      background: '#fff',
      borderBottom: `1px solid ${C.grisBorde}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="nav-inner">

        {/* Logo */}
        <Link href="/chat" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/fauba-icon.png" alt="FAUBA" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.texto, lineHeight: 1.2 }}>Asistente FAUBA</div>
            <div className="hide-mobile" style={{ fontSize: 11, color: C.textoSuave, lineHeight: 1.2 }}>Material de Cátedra</div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="nav-links">
          <NavLink href="/chat" active={pathname === '/chat'}>Consultas</NavLink>
          <NavLink href="/history" active={pathname === '/history'}>Historial</NavLink>
          {user?.role === 'admin' && (
            <NavLink href="/admin" active={pathname?.startsWith('/admin')}>Administración</NavLink>
          )}
        </nav>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && (
            <div className="hide-mobile" style={{
              background: C.verdeLight,
              border: `1px solid #c8dfc0`,
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              color: C.verdeDark,
              fontWeight: 500,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.email}
            </div>
          )}
          <button onClick={logout} style={{
            background: 'transparent',
            border: `1px solid ${C.grisBorde}`,
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: C.textoSuave,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = '#c0392b'); (e.currentTarget.style.color = '#c0392b'); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = C.grisBorde); (e.currentTarget.style.color = C.textoSuave); }}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active: boolean }) {
  return (
    <Link href={href} style={{
      padding: '6px 14px',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      textDecoration: 'none',
      color: active ? C.verde : C.textoMedio,
      background: active ? C.verdeLight : 'transparent',
      transition: 'all 0.15s',
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.background = C.gris); }}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
    >
      {children}
    </Link>
  );
}
