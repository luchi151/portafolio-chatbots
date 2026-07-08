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
// Demo data to populate the analytics dashboard. createdAt is spread across the
// last ~20 days (relative to seed time) so the activity chart isn't flat.

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const CONVERSATIONS: (typeof conversations.$inferInsert)[] = [
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-001',
    createdAt: daysAgo(1),
    messages: [
      { role: 'user', content: '¿Cuál es mi saldo actual?' },
      { role: 'assistant', content: 'Tu saldo actual es de $4.250.000 COP. La fecha de vencimiento es el 15 de julio de 2026.' },
      { role: 'user', content: '¿Puedo hacer un acuerdo de pago?' },
      { role: 'assistant', content: 'Por supuesto. Podemos estructurar un acuerdo a 6 cuotas de aproximadamente $708.333 por mes. ¿Te gustaría proceder?' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta', 'calcular_plan_pago'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-002',
    createdAt: daysAgo(2),
    messages: [
      { role: 'user', content: 'Tengo problemas para pagar este mes.' },
      { role: 'assistant', content: 'Entiendo tu situación. Podemos explorar un alivio temporal o restructuración de tu deuda. ¿Cuál es tu capacidad de pago mensual actualmente?' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['verificar_mora'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-003',
    createdAt: daysAgo(0),
    messages: [
      { role: 'user', content: 'Quiero saber mis opciones de refinanciación' },
      { role: 'assistant', content: 'Tenemos tres opciones disponibles: (1) Extensión de plazo a 24 meses con tasa del 1.8% mensual, (2) Pago único con descuento del 15% sobre intereses, (3) Cuota fija de $500.000 por 6 meses.' },
      { role: 'user', content: 'Me interesa la opción 1' },
      { role: 'assistant', content: 'Perfecto. Para la extensión a 24 meses, tu cuota mensual sería de aproximadamente $210.416 COP. ¿Confirmas esta opción?' },
      { role: 'user', content: 'Sí, confirmo' },
      { role: 'assistant', content: 'Excelente. He registrado tu solicitud de refinanciación a 24 meses. Un asesor se comunicará contigo en las próximas 24 horas para formalizar el acuerdo. ¿Hay algo más en lo que pueda ayudarte?' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['calcular_plan_pago'], hasCustomer: true },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-004',
    createdAt: daysAgo(1),
    messages: [
      { role: 'user', content: '[Voz] Quiero conocer mi deuda' },
      { role: 'assistant', content: '[Audio] Su deuda actual es de ocho millones setecientos cincuenta mil pesos colombianos. Vence el primero de agosto de dos mil veintiséis.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta'], hasCustomer: true },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-005',
    createdAt: daysAgo(3),
    messages: [
      { role: 'user', content: '[Voz] ¿Qué pasa si no pago?' },
      { role: 'assistant', content: '[Audio] Si no realiza su pago, se generarán intereses de mora del dos punto cuatro por ciento mensual y su información podría reportarse a centrales de riesgo después de 30 días.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['verificar_mora'], hasCustomer: true },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-006',
    createdAt: daysAgo(0),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: 'SELECT name, debt_amount, debt_status FROM customers ORDER BY debt_amount DESC LIMIT 5',
      rowCount: 5,
      executionTime: 210,
      usedRealDB: true,
      visualizationType: 'bar',
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-007',
    createdAt: daysAgo(2),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: "SELECT debt_status, COUNT(*) AS total, SUM(debt_amount) AS total_deuda FROM customers GROUP BY debt_status ORDER BY total DESC",
      rowCount: 4,
      executionTime: 340,
      usedRealDB: true,
      visualizationType: 'pie',
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-008',
    createdAt: daysAgo(4),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: "SELECT name, phone, debt_amount FROM customers WHERE debt_status = 'acuerdo' AND debt_amount > 1000000 ORDER BY debt_amount DESC",
      rowCount: 3,
      executionTime: 180,
      usedRealDB: true,
      visualizationType: 'table',
    },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-009',
    createdAt: daysAgo(5),
    messages: [
      { role: 'user', content: '¿Cuánto debo?' },
      { role: 'assistant', content: 'Tu saldo actual es de $8.750.000 COP, estado al día.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-010',
    createdAt: daysAgo(6),
    messages: [
      { role: 'user', content: 'Quiero pagar en 12 cuotas' },
      { role: 'assistant', content: 'Con 12 cuotas tu pago mensual sería de aproximadamente $237.500 COP al 2.5% mensual.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['calcular_plan_pago'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-011',
    createdAt: daysAgo(8),
    messages: [
      { role: 'user', content: '¿Estoy en mora? ¿Cuáles son mis opciones?' },
      { role: 'assistant', content: 'Sí, tu cuenta está en mora. Puedo ofrecerte un plan de pago a 6, 12 o 24 cuotas para ponerte al día.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['verificar_mora', 'calcular_plan_pago'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-012',
    createdAt: daysAgo(10),
    messages: [
      { role: 'user', content: '¿Cuál fue mi último contacto con la entidad?' },
      { role: 'assistant', content: 'Tu último contacto registrado fue el 20 de junio de 2026.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta'], hasCustomer: true },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-013',
    createdAt: daysAgo(6),
    messages: [
      { role: 'user', content: '[Voz] ¿Cuál es mi saldo?' },
      { role: 'assistant', content: '[Audio] Su saldo actual es de cinco millones ochocientos mil pesos colombianos.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta'], hasCustomer: true },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-014',
    createdAt: daysAgo(9),
    messages: [
      { role: 'user', content: '[Voz] Quiero un plan de pago a 6 meses' },
      { role: 'assistant', content: '[Audio] Su cuota mensual a 6 meses sería de aproximadamente novecientos sesenta y seis mil pesos.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['calcular_plan_pago'], hasCustomer: true },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-015',
    createdAt: daysAgo(12),
    messages: [
      { role: 'user', content: '[Voz] Hola' },
      { role: 'assistant', content: '[Audio] Hola, soy el asistente de cobranza. ¿En qué puedo ayudarte con tu deuda hoy?' },
    ],
    metadata: { event: 'message_sent', toolsUsed: [], hasCustomer: true },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-016',
    createdAt: daysAgo(5),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: "SELECT name, debt_amount FROM customers WHERE debt_status = 'mora' ORDER BY debt_amount DESC",
      rowCount: 5,
      executionTime: 260,
      usedRealDB: true,
      visualizationType: 'bar',
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-017',
    createdAt: daysAgo(7),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: 'SELECT COUNT(*) AS total_clientes, AVG(debt_amount) AS deuda_promedio FROM customers',
      rowCount: 1,
      executionTime: 150,
      usedRealDB: true,
      visualizationType: 'table',
    },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-018',
    createdAt: daysAgo(11),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: "SELECT debt_status, SUM(debt_amount) AS total FROM customers GROUP BY debt_status",
      rowCount: 4,
      executionTime: 0,
      usedRealDB: false,
      visualizationType: 'pie',
    },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-019',
    createdAt: daysAgo(14),
    messages: [
      { role: 'user', content: '¿Por qué me están cobrando intereses?' },
      { role: 'assistant', content: 'Tu cuenta está en mora, lo que genera intereses moratorios. Puedo ayudarte a estructurar un plan de pago para evitarlos.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['verificar_mora'], hasCustomer: true },
  },
  {
    demoType: 'db_query',
    sessionId: 'demo-session-020',
    createdAt: daysAgo(15),
    messages: [],
    metadata: {
      event: 'query_executed',
      sql: 'SELECT name, last_contact_date FROM customers ORDER BY last_contact_date ASC LIMIT 5',
      rowCount: 5,
      executionTime: 220,
      usedRealDB: true,
      visualizationType: 'table',
    },
  },
  {
    demoType: 'voicebot',
    sessionId: 'demo-session-021',
    createdAt: daysAgo(17),
    messages: [
      { role: 'user', content: '[Voz] ¿Estoy en mora?' },
      { role: 'assistant', content: '[Audio] Sí, su cuenta presenta mora. Le recomiendo estructurar un acuerdo de pago.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['verificar_mora'], hasCustomer: true },
  },
  {
    demoType: 'chatbot',
    sessionId: 'demo-session-022',
    createdAt: daysAgo(19),
    messages: [
      { role: 'user', content: 'Necesito saber mi estado de cuenta completo' },
      { role: 'assistant', content: 'Tu cuenta está en mora con un saldo de $12.300.000 COP. Último contacto: 28 de mayo de 2026.' },
    ],
    metadata: { event: 'message_sent', toolsUsed: ['consultar_cuenta', 'verificar_mora'], hasCustomer: true },
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
