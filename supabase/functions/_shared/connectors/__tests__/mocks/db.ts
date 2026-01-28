/**
 * Database Mock Utilities for Testing
 *
 * Provides mock implementations of database functions from db.ts
 */

import type {
  DeleteResult,
  Entity,
  SyncState,
  UpsertEntityData,
  UpsertResult,
} from '../../../db.ts';

// =============================================================================
// In-Memory Database Store
// =============================================================================

/**
 * In-memory entity store for testing
 */
export class MockEntityStore {
  private entities: Map<string, Entity> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private idCounter = 1;

  /**
   * Generate a composite key for entity lookup
   */
  private entityKey(appKey: string, collectionKey: string, externalId: string): string {
    return `${appKey}:${collectionKey}:${externalId}`;
  }

  /**
   * Generate a composite key for sync state lookup
   */
  private syncStateKey(appKey: string, collectionKey: string): string {
    return `${appKey}:${collectionKey}`;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.entities.clear();
    this.syncStates.clear();
    this.idCounter = 1;
  }

  /**
   * Get the number of entities
   */
  get entityCount(): number {
    return this.entities.size;
  }

  /**
   * Get all entities as an array
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Mock upsertEntity implementation
   */
  upsertEntity(data: UpsertEntityData): UpsertResult {
    const key = this.entityKey(data.app_key, data.collection_key, data.external_id);
    const existing = this.entities.get(key);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const updated: Entity = {
        ...existing,
        raw_payload: data.raw_payload,
        api_version: data.api_version ?? null,
        archived_at: data.archived_at ?? null,
        updated_at: now,
      };
      this.entities.set(key, updated);
      return { data: updated, error: null, created: false };
    } else {
      // Create new
      const entity: Entity = {
        id: `entity_${this.idCounter++}`,
        external_id: data.external_id,
        app_key: data.app_key,
        collection_key: data.collection_key,
        api_version: data.api_version ?? null,
        raw_payload: data.raw_payload,
        created_at: now,
        updated_at: now,
        archived_at: data.archived_at ?? null,
        deleted_at: null,
      };
      this.entities.set(key, entity);
      return { data: entity, error: null, created: true };
    }
  }

  /**
   * Mock upsertEntities implementation
   */
  upsertEntities(
    entities: UpsertEntityData[],
  ): { data: Entity[] | null; error: Error | null } {
    const results: Entity[] = [];

    for (const entityData of entities) {
      const result = this.upsertEntity(entityData);
      if (result.error) {
        return { data: null, error: result.error };
      }
      if (result.data) {
        results.push(result.data);
      }
    }

    return { data: results, error: null };
  }

  /**
   * Mock deleteEntity implementation
   */
  deleteEntity(
    appKey: string,
    collectionKey: string,
    externalId: string,
  ): DeleteResult {
    const key = this.entityKey(appKey, collectionKey, externalId);
    const existed = this.entities.has(key);
    this.entities.delete(key);
    return { count: existed ? 1 : 0, error: null };
  }

  /**
   * Mock deleteEntities implementation
   */
  deleteEntities(appKey: string, collectionKey?: string): DeleteResult {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, entity] of this.entities.entries()) {
      if (entity.app_key === appKey) {
        if (!collectionKey || entity.collection_key === collectionKey) {
          keysToDelete.push(key);
          count++;
        }
      }
    }

    for (const key of keysToDelete) {
      this.entities.delete(key);
    }

    return { count, error: null };
  }

  /**
   * Mock getEntity implementation
   */
  getEntity(
    appKey: string,
    collectionKey: string,
    externalId: string,
  ): { data: Entity | null; error: Error | null } {
    const key = this.entityKey(appKey, collectionKey, externalId);
    const entity = this.entities.get(key) ?? null;
    return { data: entity, error: null };
  }

  /**
   * Mock getEntityExternalIds implementation
   */
  getEntityExternalIds(
    appKey: string,
    collectionKey: string,
  ): { data: Set<string> | null; error: Error | null } {
    const ids = new Set<string>();

    for (const entity of this.entities.values()) {
      if (entity.app_key === appKey && entity.collection_key === collectionKey) {
        ids.add(entity.external_id);
      }
    }

    return { data: ids, error: null };
  }

  /**
   * Mock getEntityExternalIdsCreatedAfter implementation
   */
  getEntityExternalIdsCreatedAfter(
    appKey: string,
    collectionKey: string,
    createdGte: number,
  ): { data: Set<string> | null; error: Error | null } {
    const ids = new Set<string>();

    for (const entity of this.entities.values()) {
      if (entity.app_key === appKey && entity.collection_key === collectionKey) {
        const created = entity.raw_payload?.created;
        if (typeof created === 'number' && created >= createdGte) {
          ids.add(entity.external_id);
        }
      }
    }

    return { data: ids, error: null };
  }

  /**
   * Mock getSyncState implementation
   */
  getSyncState(
    appKey: string,
    collectionKey: string,
  ): { data: SyncState | null; error: Error | null } {
    const key = this.syncStateKey(appKey, collectionKey);
    const state = this.syncStates.get(key) ?? null;
    return { data: state, error: null };
  }

  /**
   * Mock updateSyncState implementation
   */
  updateSyncState(
    appKey: string,
    collectionKey: string,
    lastSyncedAt: Date,
    metadata?: Record<string, unknown>,
  ): { data: SyncState | null; error: Error | null } {
    const key = this.syncStateKey(appKey, collectionKey);
    const existing = this.syncStates.get(key);
    const now = new Date().toISOString();

    const state: SyncState = {
      id: existing?.id ?? `sync_${this.idCounter++}`,
      app_key: appKey,
      collection_key: collectionKey,
      last_synced_at: lastSyncedAt.toISOString(),
      last_sync_metadata: metadata ?? {},
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    this.syncStates.set(key, state);
    return { data: state, error: null };
  }

  /**
   * Mock getSyncStates implementation
   */
  getSyncStates(appKey: string): { data: SyncState[] | null; error: Error | null } {
    const states: SyncState[] = [];

    for (const state of this.syncStates.values()) {
      if (state.app_key === appKey) {
        states.push(state);
      }
    }

    return { data: states, error: null };
  }
}

// =============================================================================
// Database Mock Factory
// =============================================================================

/**
 * Create a mock database instance with all db.ts functions
 */
export function createMockDatabase() {
  const store = new MockEntityStore();

  return {
    store,

    upsertEntity: (data: UpsertEntityData) => Promise.resolve(store.upsertEntity(data)),

    upsertEntities: (entities: UpsertEntityData[]) =>
      Promise.resolve(store.upsertEntities(entities)),

    deleteEntity: (appKey: string, collectionKey: string, externalId: string) =>
      Promise.resolve(store.deleteEntity(appKey, collectionKey, externalId)),

    deleteEntities: (appKey: string, collectionKey?: string) =>
      Promise.resolve(store.deleteEntities(appKey, collectionKey)),

    getEntity: (appKey: string, collectionKey: string, externalId: string) =>
      Promise.resolve(store.getEntity(appKey, collectionKey, externalId)),

    getEntityExternalIds: (appKey: string, collectionKey: string) =>
      Promise.resolve(store.getEntityExternalIds(appKey, collectionKey)),

    getEntityExternalIdsCreatedAfter: (
      appKey: string,
      collectionKey: string,
      createdGte: number,
    ) => Promise.resolve(store.getEntityExternalIdsCreatedAfter(appKey, collectionKey, createdGte)),

    getSyncState: (appKey: string, collectionKey: string) =>
      Promise.resolve(store.getSyncState(appKey, collectionKey)),

    updateSyncState: (
      appKey: string,
      collectionKey: string,
      lastSyncedAt: Date,
      metadata?: Record<string, unknown>,
    ) => Promise.resolve(store.updateSyncState(appKey, collectionKey, lastSyncedAt, metadata)),

    getSyncStates: (appKey: string) => Promise.resolve(store.getSyncStates(appKey)),

    clear: () => store.clear(),
  };
}

/**
 * Type for the mock database
 */
export type MockDatabase = ReturnType<typeof createMockDatabase>;
