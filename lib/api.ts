const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Avisa al AuthProvider que el token ya no sirve (venció, o sacaron al usuario
// de la lista de autorizados) para que cierre la sesión.
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export function notifyIfUnauthorized(res: Response) {
  if (res.status === 401 && typeof window !== 'undefined' && localStorage.getItem('token')) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    notifyIfUnauthorized(res);
    const body = await res.json().catch(() => ({}));
    // Los errores de validación llegan como lista de mensajes.
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    throw new Error(message || `HTTP ${res.status}`);
  }

  return res.json();
}
