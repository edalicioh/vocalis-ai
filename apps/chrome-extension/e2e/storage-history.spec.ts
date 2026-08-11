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
      acceptDownloads: true,
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

  test('deve exibir e baixar o áudio (.webm) quando a gravação existe no IndexedDB', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Navega para a página de opções da extensão
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html?tab=history`);

    // Injeta uma conversa salva com audioKey no chrome.storage.local
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const mockItem = {
          id: 'conv-audio-e2e',
          title: 'Reunião de Planejamento com Gravação',
          url: 'https://meet.google.com/audio-e2e',
          timestamp: Date.now(),
          audioKey: 'conv-audio-e2e',
          transcriptions: [
            {
              id: 'utt-1',
              speaker: 'candidate',
              text: 'Vamos alinhar os próximos passos do projeto.',
              timestamp: Date.now(),
              isFinal: true
            }
          ],
          suggestions: []
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

    // Cria uma gravação completa no IndexedDB da extensão (mesma origem da página de opções)
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const openReq = indexedDB.open('CopilotAudioDB', 1);
        openReq.onupgradeneeded = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains('recordings')) {
            db.createObjectStore('recordings', { keyPath: 'sessionId' });
          }
          if (!db.objectStoreNames.contains('chunks')) {
            const store = db.createObjectStore('chunks', { keyPath: 'key' });
            store.createIndex('bySessionId', 'sessionId', { unique: false });
          }
        };
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction(['recordings', 'chunks'], 'readwrite');
          tx.objectStore('recordings').put({
            sessionId: 'conv-audio-e2e',
            mimeType: 'audio/webm;codecs=opus',
            size: 4,
            chunkCount: 1,
            status: 'complete',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastChunkIndex: 0
          });
          tx.objectStore('chunks').put({
            key: 'conv-audio-e2e:0',
            sessionId: 'conv-audio-e2e',
            index: 0,
            data: new Blob([new Uint8Array([0x1f, 0xf5, 0xde, 0xad])], { type: 'audio/webm;codecs=opus' })
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        openReq.onerror = () => reject(openReq.error);
      });
    });

    // Recarrega a página para atualizar o histórico
    await page.reload();

    const historyTab = page.locator('button >> text=Histórico de Reuniões');
    await historyTab.click();

    const cardTitle = page.locator('text=Reunião de Planejamento com Gravação');
    await expect(cardTitle).toBeVisible({ timeout: 10000 });

    // O botão de download do áudio deve aparecer
    const audioBtn = page.locator('button:has-text("Baixar Áudio (.webm)")');
    await expect(audioBtn).toBeVisible({ timeout: 10000 });

    // Dispara o download e valida o nome do arquivo
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await audioBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^copilot-audio-.*\.webm$/);
  });
});
