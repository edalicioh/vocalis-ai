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

  test('deve manter os painéis fechados até a captura ser ativada', async ({ context }) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('copilotWidgetStates', JSON.stringify({
        functionBar: { visible: true, minimized: false },
        status: { visible: true, minimized: false },
        response: { visible: true, minimized: false },
        transcription: { visible: true, minimized: false }
      }));
    });
    await page.goto('https://meet.google.com/test-room');

    const responsePanel = page.locator('#conversation-copilot-host >> text=Sugestão da IA');
    const transcriptionPanel = page.locator('#conversation-copilot-host >> text=Transcrição ao Vivo');
    await expect(responsePanel).toHaveCount(0);
    await expect(transcriptionPanel).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('copilot:capture-state-changed', {
        detail: { isCapturing: true }
      }));
    });
    await expect(responsePanel).toBeVisible();
    await expect(transcriptionPanel).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('copilot:capture-state-changed', {
        detail: { isCapturing: false }
      }));
    });
    await expect(responsePanel).toHaveCount(0);
    await expect(transcriptionPanel).toHaveCount(0);
  });

  test('deve limpar o estado de captura ao recarregar a aba', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://meet.google.com/test-room');

    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');

    const tabId = await background.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return activeTab.id;
    });
    expect(tabId).toBeTruthy();

    const captureKey = `copilotCaptureState:${tabId}`;
    await background.evaluate(async ({ key }) => {
      await chrome.storage.session.set({ [key]: true });
    }, { key: captureKey });

    await page.reload();

    await expect.poll(() => background.evaluate(async ({ key }) => {
      const stored = await chrome.storage.session.get(key);
      return stored[key] === true;
    }, { key: captureKey })).toBe(false);
  });

  test('deve gerar e expor um novo ID para cada sessão solicitada', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://meet.google.com/test-room');
    await expect(page.locator('#conversation-copilot-host')).toBeAttached({ timeout: 15000 });

    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');

    const tabId = await background.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return activeTab.id;
    });
    expect(tabId).toBeTruthy();

    const sessionIds = await background.evaluate(async ({ targetTabId }) => {
      const first = await chrome.tabs.sendMessage(targetTabId!, { type: 'CREATE_COPILOT_SESSION' });
      const second = await chrome.tabs.sendMessage(targetTabId!, { type: 'CREATE_COPILOT_SESSION' });
      const current = await chrome.tabs.sendMessage(targetTabId!, { type: 'GET_COPILOT_SESSION' });
      return [first.sessionId, second.sessionId, current.sessionId];
    }, { targetTabId: tabId });

    expect(sessionIds[0]).toMatch(/^session-tab-/);
    expect(sessionIds[1]).toMatch(/^session-tab-/);
    expect(sessionIds[1]).not.toBe(sessionIds[0]);
    expect(sessionIds[2]).toBe(sessionIds[1]);
  });

  test('deve trocar o modo de reunião para general pelo HUD e persistir no storage', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://meet.google.com/test-room');
    await expect(page.locator('#conversation-copilot-host')).toBeAttached({ timeout: 15000 });

    const modeButton = page.locator('#conversation-copilot-host >> [title="Modo ativo: Entrevista Técnica"]');
    await expect(modeButton).toBeVisible({ timeout: 10000 });

    await modeButton.click();
    await page.locator('#conversation-copilot-host >> text=Reunião Geral').click();

    await expect(page.locator('#conversation-copilot-host >> [title="Modo ativo: Reunião Geral"]')).toBeVisible();

    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');

    await expect.poll(async () => {
      const stored = await background.evaluate(async () => {
        return (await chrome.storage.local.get('meetingMode')).meetingMode;
      });
      return stored;
    }).toBe('general');
  });
});
