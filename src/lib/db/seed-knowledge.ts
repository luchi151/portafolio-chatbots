/**
 * Ingestion script — resets and repopulates the knowledge_base table used by
 * the /demos/support RAG demo. Run with: pnpm tsx src/lib/db/seed-knowledge.ts
 * Requires VOYAGE_API_KEY and DATABASE_URL in .env.local.
 * WARNING: deletes all existing rows in knowledge_base.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { knowledgeBase } from './schema';
import { embedDocuments } from '../rag/embeddings';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}
const client = postgres(url, { prepare: false });
const db = drizzle(client, { schema });

// Fictional FAQ/policy entries for a Colombian collections agency demo — same
// domain as the chatbot/voicebot demos. Each entry is already the right size
// for a retrieval chunk; no chunking pipeline needed at this scale.
const ENTRIES: { title: string; content: string }[] = [
  {
    title: 'Cómo se calculan los intereses de mora',
    content:
      'Los intereses de mora se calculan sobre el saldo vencido a una tasa del 2.5% mensual, aplicada de forma simple (no compuesta) desde el primer día de retraso. Por ejemplo, un saldo vencido de $1.000.000 COP genera $25.000 de interés por cada mes de atraso. Estos intereses se detienen apenas se pone la cuenta al día o se firma un acuerdo de pago.',
  },
  {
    title: 'Qué pasa si no pago mi cuota',
    content:
      'Si no realizas el pago en la fecha acordada, tu cuenta entra en mora al día siguiente y comienzan a generarse intereses moratorios. A los 30 días de mora, tu información puede reportarse a centrales de riesgo (como Datacrédito). A los 60 días, tu caso puede escalarse a un asesor humano para gestión especializada o cobro jurídico.',
  },
  {
    title: 'Política de reestructuración de deuda',
    content:
      'Puedes solicitar una reestructuración si tu situación financiera cambió (pérdida de empleo, reducción de ingresos). Se evalúa caso por caso y puede incluir: extensión del plazo hasta 24 meses, reducción temporal de la tasa de interés, o un periodo de gracia de hasta 2 meses sin pagos. La solicitud requiere hablar con un asesor humano — el chatbot no puede aprobar reestructuraciones directamente.',
  },
  {
    title: 'Medios de pago aceptados',
    content:
      'Aceptamos pagos por PSE (débito desde cualquier banco colombiano), tarjeta de crédito o débito, corresponsales bancarios (Efecty, Baloto) y transferencia bancaria directa a la cuenta de la entidad. Los pagos se reflejan en tu cuenta entre 1 y 3 días hábiles, excepto PSE que es inmediato.',
  },
  {
    title: 'Cómo solicitar un certificado de paz y salvo',
    content:
      'Una vez tu saldo queda en $0, puedes solicitar el certificado de paz y salvo escribiendo a la línea de atención con tu número de documento. El certificado se emite en un plazo de 5 días hábiles y confirma que no tienes obligaciones pendientes con la entidad. Es un documento útil para trámites de crédito futuros.',
  },
  {
    title: 'Reporte a centrales de riesgo',
    content:
      'Las obligaciones en mora se reportan a centrales de riesgo (Datacrédito, TransUnion) a partir de los 30 días de atraso, conforme a la ley de Habeas Data (Ley 1266 de 2008). Una vez pagada la totalidad de la deuda, la entidad actualiza el reporte dentro de los siguientes 10 días hábiles, y el historial negativo permanece visible por un tiempo igual al de la mora, con un máximo de 4 años.',
  },
  {
    title: 'Cómo disputar un cobro que consideras incorrecto',
    content:
      'Si crees que un cobro es incorrecto (por ejemplo, un pago ya realizado que sigue apareciendo pendiente), debes indicarlo explícitamente para que tu caso se escale a un asesor humano con el comprobante de pago correspondiente. El chatbot no puede resolver disputas de cobro por sí mismo, solo puede registrar la solicitud y transferir tu caso.',
  },
  {
    title: 'Qué hacer si sospechas de fraude o suplantación',
    content:
      'Si recibiste una notificación de cobro que no reconoces, o sospechas que alguien más solicitó un crédito a tu nombre, repórtalo de inmediato como un caso de fraude para que se escale a un asesor humano y al equipo de seguridad. No debes realizar ningún pago hasta que el caso sea verificado.',
  },
  {
    title: 'Tiempos de atención de PQR (peticiones, quejas y reclamos)',
    content:
      'Las peticiones se responden en un máximo de 15 días hábiles, las quejas en 15 días hábiles, y los reclamos relacionados con reportes a centrales de riesgo en un máximo de 8 días hábiles según la normativa vigente. Puedes hacer seguimiento a tu caso con el número de ticket que te entrega el asesor al escalar tu solicitud.',
  },
  {
    title: 'Protección de datos personales',
    content:
      'Tu información personal y financiera se maneja conforme a la Ley 1581 de 2012 de protección de datos. Solo se usa para gestionar tu obligación crediticia y no se comparte con terceros salvo obligación legal (como el reporte a centrales de riesgo). Puedes solicitar conocer, actualizar o eliminar tus datos personales escribiendo a la línea de atención.',
  },
  {
    title: 'Opciones de pago único con descuento',
    content:
      'Si prefieres cancelar tu deuda de una sola vez en lugar de un plan de cuotas, algunas cuentas en mora califican para un descuento sobre los intereses acumulados (hasta 15%, dependiendo de la antigüedad de la mora). Esta oferta debe confirmarse con un asesor humano, ya que el porcentaje varía caso por caso.',
  },
  {
    title: 'Qué es un acuerdo de pago y cómo funciona',
    content:
      'Un acuerdo de pago es un compromiso formal para ponerte al día mediante cuotas fijas mensuales, generalmente a 3, 6, 12 o 24 meses, con una tasa de interés del 2.5% mensual sobre saldo. Mientras cumplas el acuerdo, no se generan reportes negativos adicionales ni se escala tu caso a cobro jurídico. Si incumples dos cuotas seguidas, el acuerdo se cancela automáticamente y vuelve a aplicar la mora original.',
  },
  {
    title: 'Cómo actualizar mis datos de contacto',
    content:
      'Puedes actualizar tu número de teléfono, correo electrónico o dirección de notificación escribiendo a la línea de atención con tu número de documento y los datos nuevos. Mantener tus datos actualizados evita que se pierdan notificaciones importantes sobre vencimientos o acuerdos de pago.',
  },
  {
    title: 'Diferencia entre mora y cobro jurídico',
    content:
      'La mora es el estado inicial de atraso en el pago, gestionado por el equipo de cobranza mediante llamadas, mensajes y opciones de acuerdo. El cobro jurídico es una etapa posterior (generalmente después de 90-120 días de mora sin gestión exitosa) donde el caso se transfiere a un abogado externo y puede implicar costos adicionales de honorarios. Llegar a esta etapa se puede evitar contactando a la entidad y estableciendo un acuerdo de pago a tiempo.',
  },
  {
    title: 'Horarios de atención de asesores humanos',
    content:
      'Los asesores humanos atienden de lunes a viernes de 7:00 a.m. a 7:00 p.m. y sábados de 8:00 a.m. a 1:00 p.m., hora Colombia. Este chatbot está disponible 24/7, pero cualquier caso escalado a un asesor humano se atenderá dentro de esos horarios, con un tiempo de respuesta esperado de hasta 24 horas hábiles.',
  },
];

async function seedKnowledge() {
  if (!process.env.VOYAGE_API_KEY) {
    console.error('ERROR: VOYAGE_API_KEY no está configurada en .env.local.');
    process.exit(1);
  }

  console.log(`Generando embeddings para ${ENTRIES.length} entradas...`);
  const embeddings = await embedDocuments(ENTRIES.map((e) => `${e.title}\n\n${e.content}`));

  console.log('Reemplazando knowledge_base...');
  await db.delete(knowledgeBase);

  const rows = ENTRIES.map((e, i) => ({
    title: e.title,
    content: e.content,
    embedding: embeddings[i],
  }));
  const inserted = await db.insert(knowledgeBase).values(rows).returning({ id: knowledgeBase.id });
  console.log(`Insertados ${inserted.length} documentos ✓`);

  await client.end();
}

seedKnowledge().catch((err) => {
  console.error('Seed-knowledge failed:', err);
  process.exit(1);
});
