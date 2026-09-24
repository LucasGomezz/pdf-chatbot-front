import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Asistente Virtual – FAUBA',
  description: 'Consultá el material de la cátedra',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={{ height: '100%' }}>
      <body style={{ height: '100%' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
