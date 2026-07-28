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
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-options-'));
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

test.describe('Chrome Extension E2E — Página de Opções & Perfil', () => {
  test('deve abrir a página de Opções e exibir os títulos das abas', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navega para a página de opções da extensão
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // Verifica o título principal do painel de opções
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toContainText('Copiloto de Conversas & Entrevistas');

    // Verifica botões de navegação da página de opções
    await expect(page.locator('button >> text=Configurações Globais')).toBeVisible();
    await expect(page.locator('button >> text=Histórico de Reuniões')).toBeVisible();
  });

  test('deve alternar entre as sub-abas do formulário de configurações e salvar preferências', async ({ context, extensionId }) => {
    const page = await context.newPage();

    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // Clica na sub-aba "Perfil"
    const profileTab = page.locator('button >> text=👤 Perfil');
    await profileTab.click();

    // Preenche o campo de nome do candidato
    const nameInput = page.locator('input[placeholder*="João Silva"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('Carlos QA');
    }

    // Clica em Salvar Configurações
    const saveButton = page.locator('button >> text=Salvar Configurações');
    await saveButton.click();

    // Verifica feedback visual de sucesso (✓ Salvo!)
    const saveSuccess = page.locator('text=✓ Salvo!');
    await expect(saveSuccess).toBeVisible({ timeout: 5000 });
  });
});
