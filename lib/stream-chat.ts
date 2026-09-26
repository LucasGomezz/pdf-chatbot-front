const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface Source { chunkId: string; heading: string; snippet: string; }

export interface ChatCallbacks {
  onToken: (chunk: string) => void;
  onDone: (sources: Source[]) => void;
  onError: (message: string) => void;
  onLimit: (message: string, reason?: 'user' | 'global') => void;
}

export interface HistoryMessage { role: 'user' | 'assistant'; content: string; }

export async function streamAsk(
  question: string,
  history: HistoryMessage[],
  callbacks: ChatCallbacks,
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const url = `${BASE}/chat/ask`;

  console.log(`[streamAsk] POST ${url}  hasToken=${!!token}  historyTurns=${history.length}  question="${question.slice(0, 60)}"`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, history }),
  });

  console.log(`[streamAsk] response status=${res.status}  contentType=${res.headers.get('content-type')}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[streamAsk] error body:`, body);
    callbacks.onError(body.message || `Error ${res.status}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token') callbacks.onToken(event.data);
        else if (event.type === 'done') callbacks.onDone(event.data?.sources ?? []);
        else if (event.type === 'limit') callbacks.onLimit(event.data?.message ?? event.data, event.data?.reason);
        else if (event.type === 'chat_error') callbacks.onError(event.data);
      } catch {
        // malformed chunk, skip
      }
    }
  }
}
