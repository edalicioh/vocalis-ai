# Plano 4: Gravação e Armazenamento do Áudio Completo da Chamada

## Objetivo
Avaliar a viabilidade técnica e implementar a funcionalidade opcional de **gravação do áudio completo da reunião/chamada** (combinando o áudio da aba e o microfone do usuário em canal duplo/mixado), permitindo salvar o arquivo de áudio (`.webm` / Opus) localmente no navegador via IndexedDB e disponibilizar o download para análise, auditoria ou re-processamento futuro.

---

## Avaliação de Viabilidade Técnica e Arquitetura

### 1. Disponibilidade de Fluxo no Offscreen Document
No arquivo `apps/chrome-extension/src/offscreen/offscreen.ts`, a extensão já obtém com sucesso:
- `tabStream` (MediaStream do áudio da aba / chamadores via `chrome.tabCapture`).
- `micStream` (MediaStream do microfone local via `getUserMedia`).

Atualmente, esses fluxos são convertidos em buffers PCM 16kHz via `AudioContext` para o processador de transcrição em tempo real.

### 2. Uso da API Nativa `MediaRecorder`
É totalmente viável instanciar a API nativa `MediaRecorder` diretamente no `offscreen.ts`:
- **Mixagem dos Áudios**: Criar um `MediaStreamAudioDestinationNode` através do `audioContext`, conectando tanto o `tabSourceNode` quanto o `micSourceNode`.
- **MediaStream de Saída**: O nó de destino gera um `MediaStream` único combinando ambos os lados da conversa em tempo real.
- **Codec & Formato**: Utilizar `audio/webm;codecs=opus` com bitrate moderado (~32 kbps a 64 kbps).
  - *Consumo de Memória / Espaço*: 1 hora de áudio em Opus a 32kbps consome apenas **~14.4 MB**.

### 3. Estratégia de Armazenamento Seguro (IndexedDB)
Para evitar estourar a memória RAM em reuniões longas (2+ horas):
- Coletar blocos (`chunks`) de áudio no evento `ondataavailable` do `MediaRecorder` (a cada 10 segundos).
- Gravar os blocos no **IndexedDB** da extensão (`CopilotAudioStorage`) indexados pelo `sessionId` da chamada.
- Ao encerrar a captura, consolidar o Blob final no IndexedDB e salvar a referência no registro histórico da reunião (`conversation-storage.ts`).

### 4. Privacidade e Segurança de Dados
- **Zero Cloud**: Todo o áudio gravado permanece **100% local** no dispositivo do usuário (IndexedDB do navegador).
- **Controle de Privacidade**: A funcionalidade será acompanhada de uma opção de configuração **"Gravar áudio completo das reuniões"** (padrão: **Desativado**), garantindo consentimento explícito do usuário.

---

## Escopo e Arquivos Afetados
- `apps/chrome-extension/src/offscreen/offscreen.ts`: Inicialização do `MediaRecorder`, mixagem do `AudioDestinationNode` e envio de chunks de áudio gravado.
- `apps/chrome-extension/src/offscreen/audio-recorder-storage.ts` [NOVO]: Helper IndexedDB dedicado para armazenamento e leitura de blobs de áudio por `sessionId`.
- `apps/chrome-extension/src/shared/conversation-storage.ts`: Adicionar propriedade `audioKey` ou `hasAudioRecording: boolean` no tipo `SavedConversation`.
- `apps/chrome-extension/src/content/overlay.tsx` & `ResponsePanelWidget.tsx`: Adicionar botão de **"Baixar Áudio da Chamada (.webm)"** no painel e no histórico.
- `apps/chrome-extension/src/shared/settings-form.tsx`: Adicionar a toggle de permissão "Gravar áudio da chamada localmente".

---

## Detalhamento das Alterações

### 1. Criar Helper IndexedDB (`audio-recorder-storage.ts`)
```typescript
const DB_NAME = 'CopilotAudioDB';
const STORE_NAME = 'audio_recordings';

export async function saveAudioChunk(sessionId: string, chunk: Blob, chunkIndex: number): Promise<void>;
export async function getCompleteAudioBlob(sessionId: string): Promise<Blob | null>;
export async function deleteAudioRecording(sessionId: string): Promise<void>;
```

### 2. Mixagem e Gravação em `offscreen.ts`
```typescript
let mediaRecorder: MediaRecorder | null = null;
let recordingDestination: MediaStreamAudioDestinationNode | null = null;

// Dentro de startCapture():
if (enableAudioRecording) {
  recordingDestination = audioContext.createMediaStreamDestination();
  tabSourceNode.connect(recordingDestination);
  if (micSourceNode) micSourceNode.connect(recordingDestination);

  mediaRecorder = new MediaRecorder(recordingDestination.stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  let chunkIndex = 0;
  mediaRecorder.ondataavailable = async (e) => {
    if (e.data && e.data.size > 0 && activeSessionId) {
      await saveAudioChunk(activeSessionId, e.data, chunkIndex++);
    }
  };
  mediaRecorder.start(10000); // Salva chunks a cada 10 segundos
}
```

### 3. Botão de Exportação / Download na UI
- No histórico de reuniões salvas (`conversation-storage.ts` / `overlay.tsx`), quando `hasAudioRecording === true`, exibir o botão com ícone de áudio 🎧 **"Baixar Áudio (.webm)"**.
- Ao clicar, resgatar o Blob completo via `getCompleteAudioBlob(sessionId)` e disparar o download com nome `copilot-audio-[data]-[sessionId].webm`.

---

## Verificação e Testes

### Testes Automatizados
- Executar `npm test`.
- Adicionar testes para os métodos do `audio-recorder-storage.ts` (armazenamento e montagem do Blob via IndexedDB mock ou ambiente jsdom/vitest).

### Verificação Manual
1. Ativar a opção "Gravar áudio da chamada localmente" nas configurações.
2. Iniciar a captura de uma reunião de teste (30 segundos com áudio da aba e voz do microfone).
3. Parar a captura e salvar a sessão.
4. Clicar no botão "Baixar Áudio (.webm)" e abrir o arquivo baixado em um player de mídia (ex: Chrome, VLC).
5. Confirmar que ambas as vozes (interlocutor e microfone do usuário) estão audíveis e sincronizadas.
