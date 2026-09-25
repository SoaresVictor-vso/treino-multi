import { indexedDbService, type IndexedDbEntity } from '@/lib/indexeddb';

export type OfflineCatalogStore = 'metrics' | 'exercises';

export function readCatalogRows<T extends IndexedDbEntity>(store: OfflineCatalogStore): Promise<T[]> {
  return indexedDbService.search<T>(store);
}

export function createCatalogRows<T extends IndexedDbEntity>(store: OfflineCatalogStore, rows: T[]): Promise<void> {
  return indexedDbService.anexar(store, rows);
}

export function updateCatalogRows<T extends IndexedDbEntity>(store: OfflineCatalogStore, rows: T[]): Promise<void> {
  return indexedDbService.anexar(store, rows);
}

export function replaceCatalogRows<T extends IndexedDbEntity>(store: OfflineCatalogStore, rows: T[]): Promise<void> {
  return indexedDbService.replace(store, rows);
}

export function deleteCatalogRows(store: OfflineCatalogStore, ids: string[]): Promise<void> {
  return indexedDbService.remover(store, ids);
}

export function clearCatalogRows(): Promise<void> {
  return indexedDbService.clearStores(['metrics', 'exercises']);
}
