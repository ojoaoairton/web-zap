import { UtmParams } from './utm';

export interface WebhookPayload {
  nome?: string;
  email?: string;
  telefone?: string;
  respostas: Record<string, string>;
  utms: UtmParams;
  timestamp: string;
}

export function buildWebhookPayload(
  variables: Record<string, string>,
  utms: UtmParams
): WebhookPayload {
  return {
    nome: variables.nome,
    email: variables.email,
    telefone: variables.telefone,
    respostas: { ...variables },
    utms,
    timestamp: new Date().toISOString(),
  };
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    console.error('[FlowChat] Webhook failed');
    return false;
  }
}
