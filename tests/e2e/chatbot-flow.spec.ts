import { expect, test } from '@playwright/test';

// ─── Landing page ─────────────────────────────────────────────────────────────

test.describe('Landing page', () => {
  test('loads with hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /IA Conversacional/i })).toBeVisible();
  });

  test('shows all three demo cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Asistente de Cobranza')).toBeVisible();
    await expect(page.getByText('Agente de Voz')).toBeVisible();
    await expect(page.getByText('Consultas en Lenguaje Natural')).toBeVisible();
  });

  test('shows tech stack section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Next.js 16')).toBeVisible();
    await expect(page.getByText('LangGraph.js')).toBeVisible();
    await expect(page.getByText('DeepSeek')).toBeVisible();
  });

  test('navbar has contact link pointing to email', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Contacto' });
    await expect(link).toHaveAttribute('href', /^mailto:/);
  });

  test('demo cards link to correct routes', async ({ page }) => {
    await page.goto('/');
    const chatbotLink = page.getByRole('link', { name: 'Probar Demo →' }).first();
    await expect(chatbotLink).toHaveAttribute('href', '/demos/chatbot');
  });
});

// ─── Demo shell ───────────────────────────────────────────────────────────────

test.describe('Demo shell — auth', () => {
  test('shows auth modal on chatbot page', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await expect(page.getByText('Accede a los demos')).toBeVisible();
    await expect(page.getByText('Número de cédula')).toBeVisible();
  });

  test('submit button disabled when input is empty', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await expect(page.getByRole('button', { name: 'Acceder' })).toBeDisabled();
  });

  test('submit button enables after typing a document ID', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await page.getByPlaceholder('1234567890').fill('1234567890');
    await expect(page.getByRole('button', { name: 'Acceder' })).toBeEnabled();
  });

  test('shows auth modal on voicebot page', async ({ page }) => {
    await page.goto('/demos/voicebot');
    await expect(page.getByText('Accede a los demos')).toBeVisible();
  });

  test('shows auth modal on db-query page', async ({ page }) => {
    await page.goto('/demos/db-query');
    await expect(page.getByText('Accede a los demos')).toBeVisible();
  });
});

// ─── Demo nav ─────────────────────────────────────────────────────────────────

test.describe('Demo navigation', () => {
  test('shows all three tabs', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await expect(page.getByRole('link', { name: 'Chatbot RAG' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voicebot' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'NL → SQL' })).toBeVisible();
  });

  test('chatbot tab is active on chatbot route', async ({ page }) => {
    await page.goto('/demos/chatbot');
    const chatbotTab = page.getByRole('link', { name: 'Chatbot RAG' });
    await expect(chatbotTab).toHaveAttribute('aria-current', 'page');
  });

  test('navigates to voicebot via tab', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await page.getByRole('link', { name: 'Voicebot' }).click();
    await expect(page).toHaveURL('/demos/voicebot');
  });

  test('navigates to db-query via tab', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await page.getByRole('link', { name: 'NL → SQL' }).click();
    await expect(page).toHaveURL('/demos/db-query');
  });

  test('back link returns to landing', async ({ page }) => {
    await page.goto('/demos/chatbot');
    await page.getByText('← Portafolio').click();
    await expect(page).toHaveURL('/');
  });
});

// ─── Mobile viewports ─────────────────────────────────────────────────────────

test.describe('Mobile — 375px viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('landing page renders on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /IA Conversacional/i })).toBeVisible();
  });

  test('demo cards stack vertically on mobile', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('text=Probar Demo →');
    await expect(cards.first()).toBeVisible();
  });

  test('auth modal is usable on mobile', async ({ page }) => {
    await page.goto('/demos/chatbot');
    const input = page.getByPlaceholder('1234567890');
    await expect(input).toBeVisible();
    await input.fill('9876543210');
    await expect(page.getByRole('button', { name: 'Acceder' })).toBeEnabled();
  });
});
