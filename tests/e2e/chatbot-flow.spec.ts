import { expect, test, type Page } from '@playwright/test';

// Demo pages gate their content behind a non-dismissable cédula modal
// (by design — no close button, no backdrop-click handler). Tests that only
// care about post-auth UI (nav tabs, back link) don't need to exercise the
// real auth flow — DemoShell only checks localStorage for a truthy token.
async function bypassAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('demo_token', 'e2e-test-token');
  });
}

// ─── Landing page ─────────────────────────────────────────────────────────────

test.describe('Landing page', () => {
  test('loads with hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /IA Conversacional/i })).toBeVisible();
  });

  test('shows all three demo cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Asistente de Cobranza', { exact: true })).toBeVisible();
    await expect(page.getByText('Agente de Voz', { exact: true })).toBeVisible();
    await expect(page.getByText('Consultas en Lenguaje Natural', { exact: true })).toBeVisible();
  });

  test('shows tech stack section', async ({ page }) => {
    await page.goto('/');
    const stack = page.locator('#stack');
    await expect(stack.getByText('Next.js 16', { exact: true })).toBeVisible();
    await expect(stack.getByText('LangGraph.js', { exact: true })).toBeVisible();
    await expect(stack.getByText('DeepSeek', { exact: true })).toBeVisible();
  });

  test('navbar has contact link pointing to email', async ({ page }) => {
    await page.goto('/');
    // On mobile, Contacto is hidden behind the hamburger menu — reveal it first.
    const menuButton = page.getByRole('button', { name: 'Abrir menú' });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
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
    await expect(page.getByLabel('Número de cédula')).toBeVisible();
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
  test.beforeEach(async ({ page }) => {
    // Tabs and back link live behind the auth modal's overlay — bypass it
    // so these tests exercise navigation, not the auth flow.
    await bypassAuth(page);
  });

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

// ─── Mobile nav menu (regression: nav links were unreachable on mobile) ───────

test.describe('Mobile nav menu', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('nav links are hidden until the menu is opened', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Analytics', exact: true })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Demos', exact: true })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Stack', exact: true })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Contacto', exact: true })).toBeHidden();
  });

  test('hamburger button reveals Demos, Stack, Analytics and Contacto', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menú' }).click();

    const menu = page.locator('#mobile-nav-menu');
    await expect(menu.getByRole('link', { name: 'Demos' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Stack' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Contacto' })).toBeVisible();
  });

  test('navigates to /analytics from the mobile menu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.locator('#mobile-nav-menu').getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL('/analytics');
  });

  test('menu closes automatically after navigating', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.locator('#mobile-nav-menu').getByRole('link', { name: 'Analytics' }).click();
    await expect(page.locator('#mobile-nav-menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  });

  test('the X button closes the menu without navigating', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Cerrar menú' }).click();
    await expect(page.locator('#mobile-nav-menu')).toHaveCount(0);
    await expect(page).toHaveURL('/');
  });
});
