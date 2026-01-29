/**
 * Notion Normalization Module
 *
 * Handles entity normalization and archived state detection.
 * Uses Notion UUIDs directly as entity IDs for data sources, pages, and users.
 * Data source properties use generated UUIDs since property IDs are not UUID format.
 */

import type { AppConfig, NormalizedEntity } from '../../types/index.ts';
import { DEFAULT_API_VERSION } from './client.ts';
import {
  NOTION_COLLECTION_KEYS,
  type NotionDataSource,
  type NotionDataSourceProperty,
  type NotionPage,
  type NotionResourceType,
  type NotionUser,
} from './types.ts';

// =============================================================================
// Archived State Detection
// =============================================================================

/**
 * Detect archived state for a Notion object based on resource type
 */
export function detectArchivedAt(
  resourceType: NotionResourceType,
  data: Record<string, unknown>,
): Date | undefined {
  switch (resourceType) {
    case 'data_source': {
      const dataSource = data as unknown as NotionDataSource;
      if (dataSource.archived || dataSource.in_trash) {
        return new Date(dataSource.last_edited_time);
      }
      return undefined;
    }

    case 'page': {
      const page = data as unknown as NotionPage;
      if (page.archived || page.in_trash) {
        return new Date(page.last_edited_time);
      }
      return undefined;
    }

    case 'data_source_property':
    case 'user':
      // Properties don't have archived state (they're removed when deleted)
      // Users don't have archived state in Notion
      return undefined;

    default:
      return undefined;
  }
}

// =============================================================================
// Title Extraction
// =============================================================================

/**
 * Extract title from Notion data source title array
 */
export function extractDataSourceTitle(dataSource: NotionDataSource): string {
  if (!dataSource.title || dataSource.title.length === 0) {
    return '';
  }
  return dataSource.title.map((t) => t.plain_text).join('');
}

/**
 * Extract title from Notion page properties
 * Looks for the property with type 'title'
 */
export function extractPageTitle(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map((t) => t.plain_text).join('');
    }
  }
  return '';
}

// =============================================================================
// Entity Normalization
// =============================================================================

/**
 * Create a NormalizedEntity with Notion UUID as both the id and external_id.
 *
 * Per the spec, Notion UUIDs are used directly as the entity `id` column,
 * enabling natural foreign key relationships between Notion resources.
 *
 * Used for data_source, page, and user resources.
 */
function createEntityWithNotionId(params: {
  notionId: string;
  appKey: string;
  collectionKey: string;
  rawPayload: Record<string, unknown>;
  archivedAt?: Date;
}): NormalizedEntity {
  return {
    id: params.notionId, // Use Notion UUID as the entity id
    externalId: params.notionId, // Also store as external_id for consistency
    appKey: params.appKey,
    collectionKey: params.collectionKey,
    rawPayload: params.rawPayload,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt: params.archivedAt,
  };
}

/**
 * Create a NormalizedEntity with a composite key as external ID.
 * The database will generate a UUID for the id column.
 * Used for data_source_property resources since property IDs are not UUIDs.
 */
function createEntityWithGeneratedId(params: {
  externalId: string;
  appKey: string;
  collectionKey: string;
  rawPayload: Record<string, unknown>;
  archivedAt?: Date;
}): NormalizedEntity {
  return {
    // id is not set - database will generate UUID
    externalId: params.externalId,
    appKey: params.appKey,
    collectionKey: params.collectionKey,
    rawPayload: params.rawPayload,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt: params.archivedAt,
  };
}

/**
 * Normalize a Notion Data Source to the canonical entity format
 */
export function normalizeDataSource(
  dataSource: NotionDataSource,
  appConfig: AppConfig,
): NormalizedEntity {
  const archivedAt = detectArchivedAt(
    'data_source',
    dataSource as unknown as Record<string, unknown>,
  );

  return createEntityWithNotionId({
    notionId: dataSource.id,
    appKey: appConfig.app_key,
    collectionKey: NOTION_COLLECTION_KEYS.data_source,
    rawPayload: dataSource as unknown as Record<string, unknown>,
    archivedAt,
  });
}

/**
 * Extract and normalize data source properties from a data source
 * Returns an array of normalized property entities
 */
export function extractDataSourceProperties(
  dataSource: NotionDataSource,
  appConfig: AppConfig,
): NormalizedEntity[] {
  const entities: NormalizedEntity[] = [];

  for (const [propName, propSchema] of Object.entries(dataSource.properties)) {
    // Create composite external_id: {data_source_id}:{property_id}
    const externalId = `${dataSource.id}:${propSchema.id}`;

    const propertyData: NotionDataSourceProperty = {
      data_source_id: dataSource.id,
      property_id: propSchema.id,
      name: propName,
      type: propSchema.type,
      config: propSchema as unknown as Record<string, unknown>,
    };

    entities.push(
      createEntityWithGeneratedId({
        externalId,
        appKey: appConfig.app_key,
        collectionKey: NOTION_COLLECTION_KEYS.data_source_property,
        rawPayload: propertyData as unknown as Record<string, unknown>,
      }),
    );
  }

  return entities;
}

/**
 * Normalize a Notion Page to the canonical entity format
 */
export function normalizePage(
  page: NotionPage,
  appConfig: AppConfig,
): NormalizedEntity {
  const archivedAt = detectArchivedAt('page', page as unknown as Record<string, unknown>);

  return createEntityWithNotionId({
    notionId: page.id,
    appKey: appConfig.app_key,
    collectionKey: NOTION_COLLECTION_KEYS.page,
    rawPayload: page as unknown as Record<string, unknown>,
    archivedAt,
  });
}

/**
 * Normalize a Notion User to the canonical entity format
 */
export function normalizeUser(
  user: NotionUser,
  appConfig: AppConfig,
): NormalizedEntity {
  return createEntityWithNotionId({
    notionId: user.id,
    appKey: appConfig.app_key,
    collectionKey: NOTION_COLLECTION_KEYS.user,
    rawPayload: user as unknown as Record<string, unknown>,
  });
}

/**
 * Normalize a Notion object to the canonical entity format
 * Dispatches to the appropriate normalizer based on resource type
 */
export function normalizeNotionEntity(
  resourceType: NotionResourceType,
  data: Record<string, unknown>,
  appConfig: AppConfig,
): NormalizedEntity {
  switch (resourceType) {
    case 'data_source':
      return normalizeDataSource(data as unknown as NotionDataSource, appConfig);
    case 'page':
      return normalizePage(data as unknown as NotionPage, appConfig);
    case 'user':
      return normalizeUser(data as unknown as NotionUser, appConfig);
    case 'data_source_property': {
      // For direct normalization of property data
      const propData = data as unknown as NotionDataSourceProperty;
      const externalId = `${propData.data_source_id}:${propData.property_id}`;
      return createEntityWithGeneratedId({
        externalId,
        appKey: appConfig.app_key,
        collectionKey: NOTION_COLLECTION_KEYS.data_source_property,
        rawPayload: data,
      });
    }
    default:
      throw new Error(`Unknown Notion resource type: ${resourceType}`);
  }
}
