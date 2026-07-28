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
    const nameInput = page.locator('input[placeholder*="Seu nome"]');
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

  test('deve permitir selecionar provedores de IA e customizar o nome do modelo', async ({ context, extensionId }) => {
    const page = await context.newPage();

    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // 1. Seleciona o provedor Gemini
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption('gemini');

    // 2. Verifica que o seletor de modelos do Gemini está visível
    const modelSelect = page.locator('select').nth(1);
    await expect(modelSelect).toBeVisible();

    // 3. Escolhe a opção de digitação livre
    await modelSelect.selectOption('__custom__');

    // 4. Preenche o modelo customizado
    const customModelInput = page.locator('input[placeholder*="identificador exato do modelo"]');
    await expect(customModelInput).toBeVisible();
    await customModelInput.fill('gemini-2.0-flash-exp-custom');

    // 5. Salva e verifica feedback
    const saveButton = page.locator('button >> text=Salvar Configurações');
    await saveButton.click();

    const saveSuccess = page.locator('text=✓ Salvo!');
    await expect(saveSuccess).toBeVisible({ timeout: 5000 });
  });
});
