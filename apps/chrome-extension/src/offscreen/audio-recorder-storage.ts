// ============================================================
// Armazenamento da gravação completa da chamada (IndexedDB)
// ============================================================
// O áudio gravado permanece 100% local no dispositivo do usuário.
// Metadados (chrome.storage.local) e blobs (IndexedDB) são separados
// para não estourar a quota do chrome.storage.local em reuniões longas.

const DB_NAME = 'CopilotAudioDB';
const DB_VERSION = 1;
const RECORDINGS_STORE = 'recordings';
const CHUNKS_STORE = 'chunks';

/** Limite máximo por gravação (~7 horas a 32 kbps). */
export const MAX_AUDIO_RECORDING_SIZE = 100 * 1024 * 1024;

/** TTL de gravações órfãs (não referenciadas por reunião salva). */
export const ORPHAN_AUDIO_TTL_MS = 24 * 60 * 60 * 1000;

export type AudioRecordingStatus = 'recording' | 'complete' | 'truncated';

export interface AudioRecordingMeta {
  sessionId: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  status: AudioRecordingStatus;
  createdAt: number;
  updatedAt: number;
  lastChunkIndex: number;
}

interface ChunkRecord {
  key: string;
  sessionId: string;
  index: number;
  data: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        db.createObjectStore(RECORDINGS_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const store = db.createObjectStore(CHUNKS_STORE, { keyPath: 'key' });
        store.createIndex('bySessionId', 'sessionId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runTransaction(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    operation(tx.objectStore(storeName));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecord(db: IDBDatabase, sessionId: string): Promise<AudioRecordingMeta | undefined> {
  const tx = db.transaction(RECORDINGS_STORE, 'readonly');
  return requestDone(tx.objectStore(RECORDINGS_STORE).get(sessionId));
}

async function putRecord(db: IDBDatabase, meta: AudioRecordingMeta): Promise<void> {
  return runTransaction(db, RECORDINGS_STORE, 'readwrite', store => store.put(meta));
}

async function getAllRecordings(db: IDBDatabase): Promise<AudioRecordingMeta[]> {
  const tx = db.transaction(RECORDINGS_STORE, 'readonly');
  return requestDone(tx.objectStore(RECORDINGS_STORE).getAll());
}

async function getChunksForSession(db: IDBDatabase, sessionId: string): Promise<ChunkRecord[]> {
  const tx = db.transaction(CHUNKS_STORE, 'readonly');
  const index = tx.objectStore(CHUNKS_STORE).index('bySessionId');
  return requestDone(index.getAll(sessionId));
}

async function getChunkKeysForSession(db: IDBDatabase, sessionId: string): Promise<string[]> {
  const tx = db.transaction(CHUNKS_STORE, 'readonly');
  const index = tx.objectStore(CHUNKS_STORE).index('bySessionId');
  const records = await requestDone(index.getAll(sessionId));
  return records.map(r => r.key);
}

/**
 * Cria/atualiza o registro de metadados da gravação antes do primeiro chunk.
 */
export async function initializeAudioRecording(sessionId: string, mimeType: string): Promise<void> {
  const db = await openDb();
  try {
    const existing = await getRecord(db, sessionId);
    const meta: AudioRecordingMeta = existing && existing.status === 'recording'
      ? { ...existing, mimeType: mimeType || existing.mimeType, updatedAt: Date.now() }
      : {
        sessionId,
        mimeType: mimeType || 'audio/webm',
        size: 0,
        chunkCount: 0,
        status: 'recording',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastChunkIndex: -1
      };
    await putRecord(db, meta);
  } finally {
    db.close();
  }
}

/**
 * Grava um bloco de áudio e atualiza o tamanho acumulado.
 * Retorna o tamanho total atual da gravação (para controle do limite).
 */
export async function saveAudioChunk(sessionId: string, chunk: Blob, chunkIndex: number): Promise<number> {
  const db = await openDb();
  try {
    await runTransaction(db, CHUNKS_STORE, 'readwrite', store => {
      store.put({ key: `${sessionId}:${chunkIndex}`, sessionId, index: chunkIndex, data: chunk });
    });

    const existing = await getRecord(db, sessionId);
    const meta: AudioRecordingMeta = existing
      ? {
        ...existing,
        size: (existing.size || 0) + chunk.size,
        chunkCount: (existing.chunkCount || 0) + 1,
        lastChunkIndex: Math.max(existing.lastChunkIndex ?? -1, chunkIndex),
        updatedAt: Date.now()
      }
      : {
        sessionId,
        mimeType: chunk.type || 'audio/webm',
        size: chunk.size,
        chunkCount: 1,
        status: 'recording',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastChunkIndex: chunkIndex
      };
    await putRecord(db, meta);
    return meta.size;
  } finally {
    db.close();
  }
}

/**
 * Marca a gravação como completa (ou truncada pelo limite de tamanho),
 * tornando-a disponível para download.
 */
export async function completeAudioRecording(sessionId: string, opts?: { truncated?: boolean }): Promise<void> {
  const db = await openDb();
  try {
    const existing = await getRecord(db, sessionId);
    if (!existing) return;
    await putRecord(db, {
      ...existing,
      status: opts?.truncated ? 'truncated' : 'complete',
      updatedAt: Date.now()
    });
  } finally {
    db.close();
  }
}

/**
 * Monta o Blob completo do áudio apenas no momento do download
 * (evita duplicar o áudio inteiro na memória durante o encerramento).
 */
export async function getCompleteAudioBlob(sessionId: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const meta = await getRecord(db, sessionId);
    if (!meta) return null;
    if (meta.status !== 'complete' && meta.status !== 'truncated') return null;

    const chunks = await getChunksForSession(db, sessionId);
    if (chunks.length === 0) return null;

    chunks.sort((a, b) => a.index - b.index);
    return new Blob(chunks.map(c => c.data), { type: meta.mimeType || 'audio/webm' });
  } finally {
    db.close();
  }
}

/**
 * Lista os sessionIds com gravação concluída (downloadável).
 */
export async function listCompleteAudioRecordingIds(): Promise<string[]> {
  const db = await openDb();
  try {
    const all = await getAllRecordings(db);
    return all
      .filter(m => m.status === 'complete' || m.status === 'truncated')
      .map(m => m.sessionId);
  } finally {
    db.close();
  }
}

/**
 * Exclui a gravação (blobs + metadados) de uma sessão.
 */
export async function deleteAudioRecording(sessionId: string): Promise<void> {
  const db = await openDb();
  try {
    const keys = await getChunkKeysForSession(db, sessionId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CHUNKS_STORE, RECORDINGS_STORE], 'readwrite');
      const chunksStore = tx.objectStore(CHUNKS_STORE);
      keys.forEach(key => chunksStore.delete(key));
      tx.objectStore(RECORDINGS_STORE).delete(sessionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Remove gravações órfãs (sem reunião salva correspondente) mais antigas que o TTL.
 * Retorna a quantidade de gravações removidas.
 */
export async function cleanupOrphanAudioRecordings(savedSessionIds: string[], now: number = Date.now()): Promise<number> {
  const db = await openDb();
  try {
    const all = await getAllRecordings(db);
    const saved = new Set(savedSessionIds);
    let removed = 0;
    for (const meta of all) {
      const isRecent = meta.updatedAt >= now - ORPHAN_AUDIO_TTL_MS;
      if (!saved.has(meta.sessionId) && !isRecent) {
        await deleteAudioRecording(meta.sessionId);
        removed++;
      }
    }
    return removed;
  } finally {
    db.close();
  }
}
