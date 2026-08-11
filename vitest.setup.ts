import 'fake-indexeddb/auto';
import { IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb';

if (!(globalThis as any).IDBKeyRange) {
  (globalThis as any).IDBKeyRange = FakeIDBKeyRange;
}
