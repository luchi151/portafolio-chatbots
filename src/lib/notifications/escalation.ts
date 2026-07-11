async function notifySlack(demo: string, conversationId: string, reason: string, customerName: string | null): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const cliente = customerName ?? 'Cliente demo';
  const text = `🚨 *Escalación a asesor humano*\nDemo: *${demo}*\nCliente: ${cliente}\nMotivo: ${reason}\nConversación: \`${conversationId}\``;

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
  const cliente = customerName ?? 'Cliente demo';
  const from = process.env.ESCALATION_FROM_EMAIL ?? 'onboarding@resend.dev';

  await resend.emails.send({
    from,
    to,
    subject: `Escalación a asesor humano — ${demo}`,
    html: `<p><strong>Demo:</strong> ${demo}</p><p><strong>Cliente:</strong> ${cliente}</p><p><strong>Motivo:</strong> ${reason}</p><p><strong>Conversación:</strong> ${conversationId}</p>`,
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
