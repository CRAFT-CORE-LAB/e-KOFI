export type InboundMessage = {
  from: string;
  id: string;
  text: string;
  buttonId?: string;
  kind: string;
};

export function readInbound(body: Record<string, unknown>): InboundMessage[] {
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const messages: InboundMessage[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? (entry as { changes: unknown[] }).changes
      : [];
    for (const change of changes) {
      if (!change || typeof change !== 'object') continue;
      const value = (change as { value?: unknown }).value;
      if (!value || typeof value !== 'object') continue;
      const batch = (value as { messages?: unknown }).messages;
      if (!Array.isArray(batch)) continue;
      for (const message of batch) {
        const parsed = oneMessage(message);
        if (parsed) messages.push(parsed);
      }
    }
  }
  return messages;
}

function oneMessage(message: unknown): InboundMessage | null {
  if (!message || typeof message !== 'object') return null;
  const row = message as {
    from?: unknown;
    id?: unknown;
    type?: unknown;
    text?: { body?: unknown };
    interactive?: { button_reply?: { id?: unknown; title?: unknown } };
    button?: { text?: unknown; payload?: unknown };
  };
  const from = typeof row.from === 'string' ? row.from : '';
  const id = typeof row.id === 'string' ? row.id : '';
  if (!from || !id) return null;
  if (row.type === 'text') {
    return { from, id, text: typeof row.text?.body === 'string' ? row.text.body : '', kind: 'text' };
  }
  if (row.type === 'interactive') {
    const reply = row.interactive?.button_reply;
    return {
      from,
      id,
      text: typeof reply?.title === 'string' ? reply.title : '',
      buttonId: typeof reply?.id === 'string' ? reply.id : undefined,
      kind: 'button',
    };
  }
  if (row.type === 'button') {
    return {
      from,
      id,
      text: typeof row.button?.text === 'string' ? row.button.text : '',
      buttonId: typeof row.button?.payload === 'string' ? row.button.payload : undefined,
      kind: 'button',
    };
  }
  return { from, id, text: '', kind: typeof row.type === 'string' ? row.type : 'other' };
}

export function hubField(query: Record<string, unknown>, name: 'mode' | 'verify_token' | 'challenge') {
  const flat = query[`hub.${name}`];
  if (typeof flat === 'string') return flat;
  const hub = query.hub;
  if (hub && typeof hub === 'object' && typeof (hub as Record<string, unknown>)[name] === 'string') {
    return (hub as Record<string, unknown>)[name] as string;
  }
  return '';
}
