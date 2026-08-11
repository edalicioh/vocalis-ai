import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_RECORDING_SIZE,
  ORPHAN_AUDIO_TTL_MS,
  initializeAudioRecording,
  saveAudioChunk,
  completeAudioRecording,
  getCompleteAudioBlob,
  listCompleteAudioRecordingIds,
  deleteAudioRecording,
  cleanupOrphanAudioRecordings
} from '../audio-recorder-storage';

const DB_NAME = 'CopilotAudioDB';
const MIME = 'audio/webm;codecs=opus';

async function wipeDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function makeChunk(byte: number, size = 16): Blob {
  return new Blob([new Uint8Array(size).fill(byte)], { type: MIME });
}

async function readText(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then(buf => {
    const bytes = Array.from(new Uint8Array(buf));
    return String.fromCharCode(...bytes);
  });
}

async function setMetaUpdatedAt(sessionId: string, updatedAt: number): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const getReq = store.get(sessionId);
      getReq.onsuccess = () => {
        const meta = getReq.result;
        if (meta) {
          meta.updatedAt = updatedAt;
          store.put(meta);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

beforeEach(async () => {
  await wipeDb();
});

describe('audio-recorder-storage', () => {
  it('retorna null antes de a gravação ser concluída', async () => {
    await initializeAudioRecording('sess-1', MIME);
    await saveAudioChunk('sess-1', makeChunk(1), 0);
    const blob = await getCompleteAudioBlob('sess-1');
    expect(blob).toBeNull();
  });

  it('monta o Blob completo com mimeType e concatenação em ordem', async () => {
    await initializeAudioRecording('sess-1', MIME);
    await saveAudioChunk('sess-1', makeChunk(1), 0);
    await saveAudioChunk('sess-1', makeChunk(2), 1);
    await saveAudioChunk('sess-1', makeChunk(3), 2);
    await completeAudioRecording('sess-1');

    const blob = await getCompleteAudioBlob('sess-1');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe(MIME);
    const text = await readText(blob!);
    expect(text).toBe('\x01'.repeat(16) + '\x02'.repeat(16) + '\x03'.repeat(16));
  });

  it('concatena os blocos na ordem correta mesmo quando salvos fora de ordem', async () => {
    await initializeAudioRecording('sess-1', MIME);
    await saveAudioChunk('sess-1', makeChunk(1), 2);
    await saveAudioChunk('sess-1', makeChunk(2), 0);
    await saveAudioChunk('sess-1', makeChunk(3), 1);
    await completeAudioRecording('sess-1');

    const blob = await getCompleteAudioBlob('sess-1');
    const text = await readText(blob!);
    expect(text).toBe('\x02'.repeat(16) + '\x03'.repeat(16) + '\x01'.repeat(16));
  });

  it('acumula o tamanho total a cada chunk salvo', async () => {
    await initializeAudioRecording('sess-1', MIME);
    const s1 = await saveAudioChunk('sess-1', makeChunk(1, 10), 0);
    const s2 = await saveAudioChunk('sess-1', makeChunk(2, 20), 1);
    expect(s1).toBe(10);
    expect(s2).toBe(30);
  });

  it('marca como truncated quando concluída com truncamento', async () => {
    await initializeAudioRecording('sess-1', MIME);
    await saveAudioChunk('sess-1', makeChunk(1), 0);
    await completeAudioRecording('sess-1', { truncated: true });

    const ids = await listCompleteAudioRecordingIds();
    expect(ids).toContain('sess-1');
    const blob = await getCompleteAudioBlob('sess-1');
    expect(blob).not.toBeNull();
  });

  it('lista apenas gravações concluídas', async () => {
    await initializeAudioRecording('em-andamento', MIME);
    await saveAudioChunk('em-andamento', makeChunk(1), 0);

    await initializeAudioRecording('concluida', MIME);
    await saveAudioChunk('concluida', makeChunk(1), 0);
    await completeAudioRecording('concluida');

    const ids = await listCompleteAudioRecordingIds();
    expect(ids).toEqual(['concluida']);
  });

  it('exclui a gravação (blobs + metadados) por sessionId', async () => {
    await initializeAudioRecording('sess-1', MIME);
    await saveAudioChunk('sess-1', makeChunk(1), 0);
    await completeAudioRecording('sess-1');

    await deleteAudioRecording('sess-1');
    expect(await getCompleteAudioBlob('sess-1')).toBeNull();
    expect(await listCompleteAudioRecordingIds()).toEqual([]);
  });

  it('remove órfãos antigos e preserva referenciados e recentes', async () => {
    const now = Date.now();

    await initializeAudioRecording('orfao-antigo', MIME);
    await saveAudioChunk('orfao-antigo', makeChunk(1), 0);
    await completeAudioRecording('orfao-antigo');
    await setMetaUpdatedAt('orfao-antigo', now - ORPHAN_AUDIO_TTL_MS - 1000);

    await initializeAudioRecording('referenciado', MIME);
    await saveAudioChunk('referenciado', makeChunk(1), 0);
    await completeAudioRecording('referenciado');
    await setMetaUpdatedAt('referenciado', now - ORPHAN_AUDIO_TTL_MS - 1000);

    await initializeAudioRecording('recente', MIME);
    await saveAudioChunk('recente', makeChunk(1), 0);
    await completeAudioRecording('recente');

    const removed = await cleanupOrphanAudioRecordings(['referenciado'], now);

    expect(removed).toBe(1);
    expect(await getCompleteAudioBlob('orfao-antigo')).toBeNull();
    expect(await getCompleteAudioBlob('referenciado')).not.toBeNull();
    expect(await getCompleteAudioBlob('recente')).not.toBeNull();
  });

  it('expõe o limite de tamanho da gravação', () => {
    expect(MAX_AUDIO_RECORDING_SIZE).toBe(100 * 1024 * 1024);
  });
});
