import { test as base, expect, chromium, BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../dist');

export const test = base.extend<{
  context: BrowserContext;
}>({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-overlay-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ],
    });
    await use(context);
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  },
});

test.describe('Chrome Extension E2E — Painel Flutuante (Overlay)', () => {
  test('deve injetar o container Shadow DOM (#conversation-copilot-host) em páginas de reunião como Google Meet', async ({ context }) => {
    const page = await context.newPage();

    // Navega para o Google Meet (onde isMeetingPage() é true)
    await page.goto('https://meet.google.com/test-room');

    // Aguarda a montagem do elemento hospedeiro do Shadow DOM
    const hostElement = page.locator('#conversation-copilot-host');
    await expect(hostElement).toBeAttached({ timeout: 15000 });

    // Verifica que a barra de ferramentas HUD (Iniciar) está visível dentro do Shadow DOM
    const startButton = page.locator('#conversation-copilot-host >> text=Iniciar');
    await expect(startButton).toBeVisible({ timeout: 10000 });
  });

  test('deve responder aos disparos de eventos de janela no painel flutuante', async ({ context }) => {
    const page = await context.newPage();

    await page.goto('https://meet.google.com/test-room');

    const hostElement = page.locator('#conversation-copilot-host');
    await expect(hostElement).toBeAttached({ timeout: 15000 });

    // Dispara o evento personalizado no contexto da página
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('copilot:force-trigger'));
    });

    // Verifica que o conteúdo montado dentro do Shadow DOM permanece presente e responsivo
    const startButton = page.locator('#conversation-copilot-host >> text=Iniciar');
    await expect(startButton).toBeVisible({ timeout: 10000 });
  });
});
