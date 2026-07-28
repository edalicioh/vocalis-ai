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
  extensionId: string;
}>({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-popup-'));
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
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

test.describe('Chrome Extension E2E — Popup de Atalho & Status', () => {
  test('deve carregar a interface do popup com título e controles de status', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navega diretamente para a página de popup da extensão
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    // Verifica a presença do cabeçalho do popup
    const headerTitle = page.locator('h2');
    await expect(headerTitle).toContainText('Copiloto de Conversas');

    // Verifica que o cartão de controle "Copiloto nesta página" é visível
    const statusText = page.locator('text=Copiloto nesta página');
    await expect(statusText).toBeVisible();
  });
});
