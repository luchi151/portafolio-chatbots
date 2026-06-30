/**
 * Seed script — resets and repopulates the database with demo data.
 * Run with: pnpm tsx src/lib/db/seed.ts
 * Reads DATABASE_URL from .env.local automatically.
 * WARNING: deletes all existing rows in customers, conversations, documents.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { customers, conversations, documents } from './schema';

// ─── DB client ────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}
const client = postgres(url, { prepare: false });
const db = drizzle(client, { schema });

// ─── Customer data ────────────────────────────────────────────────────────────
// 15 fictional Colombian customers with realistic COP debt data.
// debtStatus values: 'active' | 'mora' | 'acuerdo' | 'pagado'

const CUSTOMERS: (typeof customers.$inferInsert)[] = [
  {
    documentId: '12345678',
    name: 'Carlos Alberto Rodríguez Muñoz',
    phone: '3001234567',
    email: 'carlos.rodriguez@gmail.com',
    debtAmount: '4250000',
    debtStatus: 'mora',
    lastContactDate: new Date('2026-06-10'),
    notes: 'Solicita acuerdo de pago. Desempleo reciente. Prometió llamar el 30/06.',
  },
  {
    documentId: '87654321',
    name: 'María Fernanda García Ospina',
    phone: '3112345678',
    email: 'mgarcia@hotmail.com',
    debtAmount: '8750000',
    debtStatus: 'active',
    lastContactDate: new Date('2026-06-20'),
    notes: 'Cliente al día. Paga puntualmente los primeros 5 del mes.',
  },
  {
    documentId: '23456789',
    name: 'Juan David Martínez Ríos',
    phone: '3209876543',
    email: 'jdmartinez@gmail.com',
    debtAmount: '1500000',
    debtStatus: 'acuerdo',
    lastContactDate: new Date('2026-06-01'),
    notes: 'Acuerdo: $300.000 mensuales. 5 cuotas. Primer pago recibido el 05/06.',
  },
  {
    documentId: '98765432',
    name: 'Alejandra Hernández Castro',
    phone: '3156789012',
    email: 'alejandra.hc@outlook.com',
    debtAmount: '12300000',
    debtStatus: 'mora',
    lastContactDate: new Date('2026-05-28'),
    notes: 'En mora 62 días. No responde llamadas. Enviar notificación por correo.',
  },
  {
    documentId: '34567890',
    name: 'Diego Fernando López Vargas',
    phone: '3187654321',
    email: 'dlopez@gmail.com',
    debtAmount: '650000',
    debtStatus: 'pagado',
    lastContactDate: new Date('2026-06-15'),
    notes: 'Saldo cancelado en su totalidad el 15/06/2026. Cliente satisfecho.',
  },
  {
    documentId: '45678901',
    name: 'Camila Andrea González Pérez',
    phone: '3223456789',
    email: 'camila.gonzalez@gmail.com',
    debtAmount: '3200000',
    debtStatus: 'active',
    lastContactDate: new Date('2026-06-25'),
    notes: 'Refinanciación aprobada a 12 meses. Tasa 1.8% mensual.',
  },
  {
    documentId: '56789012',
    name: 'Andrés Felipe Pérez Jiménez',
    phone: '3048765432',
    email: 'andres.perez@yahoo.com',
    debtAmount: '25000000',
    debtStatus: 'mora',
    lastContactDate: new Date('2026-06-05'),
    notes: 'Deuda de alto valor. Requiere gestión especializada. Cita programada 01/07.',
  },
  {
    documentId: '67890123',
    name: 'Valentina Sánchez Bermúdez',
    phone: '3134567890',
    email: 'valen.sanchez@gmail.com',
    debtAmount: '900000',
    debtStatus: 'acuerdo',
    lastContactDate: new Date('2026-06-18'),
    notes: 'Acuerdo de 3 cuotas de $300.000. Segunda cuota recibida el 18/06.',
  },
  {
    documentId: '78901234',
    name: 'Jorge Enrique Ramírez Torres',
    phone: '3176543210',
    email: 'jorge.ramirez@gmail.com',
    debtAmount: '5800000',
    debtStatus: 'active',
    lastContactDate: new Date('2026-06-22'),
    notes: 'Cliente VIP. Historial crediticio excelente. Sin novedades.',
  },
  {
    documentId: '89012345',
    name: 'Laura Sofía Torres Medina',
    phone: '3012345678',
    email: 'laura.torres.med@gmail.com',
    debtAmount: '18400000',
    debtStatus: 'mora',
    lastContactDate: new Date('2026-05-15'),
    notes: 'Mora de 75 días. Disputa en proceso por cobro incorrecto del mes de abril.',
  },
  {
    documentId: '90123456',
    name: 'Felipe Alejandro Flores Arango',
    phone: '3245678901',
    email: 'fflores@gmail.com',
    debtAmount: '2100000',
    debtStatus: 'pagado',
    lastContactDate: new Date('2026-06-28'),
    notes: 'Pagó saldo total más intereses. Solicita certificado de paz y salvo.',
  },
  {
    documentId: '1234567890',
    name: 'Natalia Catalina Rivera Suárez',
    phone: '3101234567',
    email: 'nrivera@gmail.com',
    debtAmount: '7650000',
    debtStatus: 'active',
    lastContactDate: new Date('2026-06-26'),
    notes: 'Pago programado automáticamente. Sin gestión manual requerida.',
  },
  {
    documentId: '9876543210',
    name: 'Sebastián Gómez Quintero',
    phone: '3189876543',
    email: 'sebas.gomez@outlook.com',
    debtAmount: '440000',
    debtStatus: 'mora',
    lastContactDate: new Date('2026-06-12'),
    notes: 'Mora leve. Primera comunicación enviada. Cliente joven, 22 años.',
  },
  {
    documentId: '1122334455',
    name: 'Isabella Díaz Montoya',
    phone: '3057890123',
    email: 'isabella.diaz@gmail.com',
    debtAmount: '31000000',
    debtStatus: 'acuerdo',
    lastContactDate: new Date('2026-06-03'),
    notes: 'Acuerdo especial a 24 meses. Aval de fiador presentado. Cuota $1.450.000/mes.',
  },
  {
    documentId: '5544332211',
    name: 'Mateo Andrés Morales Cárdenas',
    phone: '3162345678',
    email: 'mateo.morales@gmail.com',
    debtAmount: '950000',
    debtStatus: 'active',
    lastContactDate: new Date('2026-06-24'),
    notes: 'Primer crédito. Sin historial previo. Pagos al día.',
  },
];

// ─── Sample conversations ─────────────────────────────────────────────────────
// Demo data to populate the analytics/history view.

const CONVERSATIONS: (typeof conversations.$inferInsert)[] = [
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-001',
    messages: [
      { role: 'user', content: '¿Cuál es mi saldo actual?' },
      { role: 'assistant', content: 'Tu saldo actual es de $4.250.000 COP. La fecha de vencimiento es el 15 de julio de 2026.' },
      { role: 'user', content: '¿Puedo hacer un acuerdo de pago?' },
      { role: 'assistant', content: 'Por supuesto. Podemos estructurar un acuerdo a 6 cuotas de aproximadamente $708.333 por mes. ¿Te gustaría proceder?' },
    ],
    metadata: { event: 'session_completed', demo: 'chatbot', messages: 4 },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-002',
    messages: [
      { role: 'user', content: 'Tengo problemas para pagar este mes.' },
      { role: 'assistant', content: 'Entiendo tu situación. Podemos explorar un alivio temporal o restructuración de tu deuda. ¿Cuál es tu capacidad de pago mensual actualmente?' },
    ],
    metadata: { event: 'session_completed', demo: 'chatbot', messages: 2 },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-003',
    messages: [
      { role: 'user', content: 'Quiero saber mis opciones de refinanciación' },
      { role: 'assistant', content: 'Tenemos tres opciones disponibles: (1) Extensión de plazo a 24 meses con tasa del 1.8% mensual, (2) Pago único con descuento del 15% sobre intereses, (3) Cuota fija de $500.000 por 6 meses.' },
      { role: 'user', content: 'Me interesa la opción 1' },
      { role: 'assistant', content: 'Perfecto. Para la extensión a 24 meses, tu cuota mensual sería de aproximadamente $210.416 COP. ¿Confirmas esta opción?' },
      { role: 'user', content: 'Sí, confirmo' },
      { role: 'assistant', content: 'Excelente. He registrado tu solicitud de refinanciación a 24 meses. Un asesor se comunicará contigo en las próximas 24 horas para formalizar el acuerdo. ¿Hay algo más en lo que pueda ayudarte?' },
    ],
    metadata: { event: 'session_completed', demo: 'chatbot', messages: 6 },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-004',
    messages: [
      { role: 'user', content: '[Voz] Quiero conocer mi deuda' },
      { role: 'assistant', content: '[Audio] Su deuda actual es de ocho millones setecientos cincuenta mil pesos colombianos. Vence el primero de agosto de dos mil veintiséis.' },
    ],
    metadata: { event: 'session_completed', demo: 'voicebot', messages: 2 },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-005',
    messages: [
      { role: 'user', content: '[Voz] ¿Qué pasa si no pago?' },
      { role: 'assistant', content: '[Audio] Si no realiza su pago, se generarán intereses de mora del dos punto cuatro por ciento mensual y su información podría reportarse a centrales de riesgo después de 30 días.' },
    ],
    metadata: { event: 'session_completed', demo: 'voicebot', messages: 2 },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-006',
    messages: [],
    metadata: {
      event: 'query_executed',
      demo: 'db_query',
      query: 'Muéstrame los clientes con más deuda',
      sql: 'SELECT name, debt_amount, debt_status FROM customers ORDER BY debt_amount DESC LIMIT 5',
      rows: 5,
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-007',
    messages: [],
    metadata: {
      event: 'query_executed',
      demo: 'db_query',
      query: '¿Cuántos clientes están en mora?',
      sql: "SELECT debt_status, COUNT(*) AS total, SUM(debt_amount) AS total_deuda FROM customers GROUP BY debt_status ORDER BY total DESC",
      rows: 4,
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-008',
    messages: [],
    metadata: {
      event: 'query_executed',
      demo: 'db_query',
      query: 'Clientes en acuerdo de pago con deuda mayor a 1 millón',
      sql: "SELECT name, phone, debt_amount FROM customers WHERE debt_status = 'acuerdo' AND debt_amount > 1000000 ORDER BY debt_amount DESC",
      rows: 3,
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding database…');

  // Clear in FK-safe order: documents → conversations → customers
  await db.delete(documents);
  console.log('  cleared documents');

  await db.delete(conversations);
  console.log('  cleared conversations');

  await db.delete(customers);
  console.log('  cleared customers');

  // Insert fresh data
  const insertedCustomers = await db.insert(customers).values(CUSTOMERS).returning({ id: customers.id });
  console.log(`  inserted ${insertedCustomers.length} customers`);

  const insertedConvs = await db.insert(conversations).values(CONVERSATIONS).returning({ id: conversations.id });
  console.log(`  inserted ${insertedConvs.length} conversations`);

  console.log('\nSeed complete ✓');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
