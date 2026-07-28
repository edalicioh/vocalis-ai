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
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-storage-'));
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

test.describe('Chrome Extension E2E — Histórico de Reuniões Salvas', () => {
  test('deve listar conversas salvas no chrome.storage e permitir busca por filtro', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navega para a página de opções da extensão
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html?tab=history`);

    // Injeta uma conversa salva simulada no chrome.storage.local
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const mockItem = {
          id: 'conv-e2e-123',
          title: 'Entrevista de Arquitetura de Sistemas',
          url: 'https://meet.google.com/test-e2e',
          timestamp: Date.now(),
          transcriptions: [
            {
              id: 'utt-1',
              speaker: 'interviewer',
              text: 'Como você lida com consistência eventual em microsserviços?',
              timestamp: Date.now(),
              isFinal: true
            }
          ],
          suggestions: [
            {
              id: 'sug-1',
              question: 'Como você lida com consistência eventual em microsserviços?',
              rawText: 'Utilizando Outbox Pattern e eventos assíncronos via Kafka.',
              timestamp: Date.now(),
              status: 'completed'
            }
          ]
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['savedConversations'], (res) => {
            const list = res.savedConversations || [];
            list.push(mockItem);
            chrome.storage.local.set({ savedConversations: list }, () => resolve());
          });
        } else {
          resolve();
        }
      });
    });

    // Recarrega a página para atualizar o histórico
    await page.reload();

    // Garante que a aba "Histórico de Reuniões" está ativa
    const historyTab = page.locator('button >> text=Histórico de Reuniões');
    await historyTab.click();

    // Verifica que o card da entrevista salva aparece no DOM
    const cardTitle = page.locator('text=Entrevista de Arquitetura de Sistemas');
    await expect(cardTitle).toBeVisible({ timeout: 10000 });

    // Testa o campo de busca/filtro
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Arquitetura');
      await expect(cardTitle).toBeVisible();

      await searchInput.fill('TermoInexistenteXYZ');
      await expect(cardTitle).not.toBeVisible();
    }
  });
});
