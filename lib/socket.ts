import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  socket = io(`${WS_URL}/chat`, {
    auth: { token },
    autoConnect: false,
    transports: ['websocket'],
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
