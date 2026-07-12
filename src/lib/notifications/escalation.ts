function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Slack mrkdwn reserves &, <, > for entity/link syntax — escape per Slack's
// own convention (https://api.slack.com/reference/surfaces/formatting#escaping).
function escapeSlack(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function notifySlack(demo: string, conversationId: string, reason: string, customerName: string | null): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const cliente = escapeSlack(customerName ?? 'Cliente demo');
  const motivo = escapeSlack(reason);
  const text = `🚨 *Escalación a asesor humano*\nDemo: *${demo}*\nCliente: ${cliente}\nMotivo: ${motivo}\nConversación: \`${conversationId}\``;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

async function notifyEmail(demo: string, conversationId: string, reason: string, customerName: string | null): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ESCALATION_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const cliente = escapeHtml(customerName ?? 'Cliente demo');
  const motivo = escapeHtml(reason);
  const from = process.env.ESCALATION_FROM_EMAIL ?? 'onboarding@resend.dev';

  await resend.emails.send({
    from,
    to,
    subject: `Escalación a asesor humano — ${demo}`,
    html: `<p><strong>Demo:</strong> ${escapeHtml(demo)}</p><p><strong>Cliente:</strong> ${cliente}</p><p><strong>Motivo:</strong> ${motivo}</p><p><strong>Conversación:</strong> ${escapeHtml(conversationId)}</p>`,
  });
}

export async function notifyEscalation(
  demo: 'chatbot' | 'voicebot',
  conversationId: string,
  reason: string,
  customerName: string | null,
): Promise<void> {
  const results = await Promise.allSettled([
    notifySlack(demo, conversationId, reason, customerName),
    notifyEmail(demo, conversationId, reason, customerName),
  ]);

  for (const r of results) {
    if (r.status === 'rejected') console.error('[escalation] notification error:', r.reason);
  }
}
