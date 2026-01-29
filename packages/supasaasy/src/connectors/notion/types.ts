/**
 * Notion Connector Types
 *
 * Type definitions specific to the Notion connector.
 * Uses Notion API version 2025-09-03 which has first-class data source support.
 */

// =============================================================================
// Resource Types
// =============================================================================

/**
 * Notion resource types supported by this connector
 */
export type NotionResourceType =
  | 'data_source'
  | 'data_source_property'
  | 'page'
  | 'user';

/**
 * Mapping of Notion resource types to collection keys
 */
export const NOTION_COLLECTION_KEYS: Record<NotionResourceType, string> = {
  data_source: 'notion_data_source',
  data_source_property: 'notion_data_source_property',
  page: 'notion_page',
  user: 'notion_user',
};

// =============================================================================
// Webhook Event Types
// =============================================================================

/**
 * Notion webhook events we handle.
 * Note: Notion webhooks are available with Enterprise plan and API version 2025-09-03+
 */
export const NOTION_WEBHOOK_EVENTS = {
  // Data source events
  'data_source.created': { resourceType: 'data_source', eventType: 'create' },
  'data_source.schema_updated': { resourceType: 'data_source', eventType: 'update' },
  'data_source.content_updated': { resourceType: 'data_source', eventType: 'update' },
  'data_source.deleted': { resourceType: 'data_source', eventType: 'delete' },
  'data_source.undeleted': { resourceType: 'data_source', eventType: 'undelete' },

  // Page events
  'page.created': { resourceType: 'page', eventType: 'create' },
  'page.properties_updated': { resourceType: 'page', eventType: 'update' },
  'page.content_updated': { resourceType: 'page', eventType: 'update' },
  'page.deleted': { resourceType: 'page', eventType: 'delete' },
  'page.undeleted': { resourceType: 'page', eventType: 'undelete' },
  // Note: Users don't have webhook support
} as const;

export type NotionWebhookEventType = keyof typeof NOTION_WEBHOOK_EVENTS;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Notion-specific app configuration
 */
export interface NotionAppConfig {
  /** Environment variable name for the API key (Internal Integration Token) */
  api_key_env?: string;
  /** Environment variable name for the webhook signing secret */
  webhook_secret_env?: string;
  /** Direct API key (not recommended for production) */
  api_key?: string;
  /** Direct webhook secret (not recommended for production) */
  webhook_secret?: string;
  /** Resource types to sync (defaults to all) */
  sync_resources?: NotionResourceType[];
  /**
   * Optional minimum timestamp for historical data sync (ISO 8601 string).
   * When set, full sync will only fetch records created on or after this date.
   */
  sync_from?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Notion API pagination structure (cursor-based)
 */
export interface NotionPaginatedResponse<T> {
  object: 'list';
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
  type?: string;
}

/**
 * Common timestamp fields in Notion objects
 */
export interface NotionTimestamps {
  created_time: string;
  last_edited_time: string;
}

/**
 * Notion user reference
 */
export interface NotionUserReference {
  object: 'user';
  id: string;
}

/**
 * Notion parent reference
 */
export interface NotionParent {
  type: 'database_id' | 'page_id' | 'workspace' | 'block_id';
  database_id?: string;
  page_id?: string;
  workspace?: boolean;
  block_id?: string;
}

/**
 * Notion Data Source (table within a database) from API
 */
export interface NotionDataSource {
  object: 'data_source';
  id: string;
  parent: {
    type: 'database_id';
    database_id: string;
  };
  title: Array<{
    type: 'text';
    text: { content: string; link?: { url: string } | null };
    plain_text: string;
    annotations?: Record<string, unknown>;
  }>;
  description?: Array<{
    type: 'text';
    text: { content: string; link?: { url: string } | null };
    plain_text: string;
  }>;
  properties: Record<string, NotionProperty>;
  icon?: NotionIcon | null;
  cover?: NotionCover | null;
  archived: boolean;
  in_trash: boolean;
  created_time: string;
  last_edited_time: string;
  created_by: NotionUserReference;
  last_edited_by: NotionUserReference;
  url: string;
  public_url?: string | null;
}

/**
 * Notion icon types
 */
export type NotionIcon =
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string; expiry_time: string } };

/**
 * Notion cover type
 */
export type NotionCover =
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string; expiry_time: string } };

/**
 * Notion property schema definition
 */
export interface NotionProperty {
  id: string;
  name: string;
  type: string;
  // Type-specific configuration
  title?: Record<string, never>;
  rich_text?: Record<string, never>;
  number?: { format: string };
  select?: { options: Array<{ id: string; name: string; color: string }> };
  multi_select?: { options: Array<{ id: string; name: string; color: string }> };
  date?: Record<string, never>;
  people?: Record<string, never>;
  files?: Record<string, never>;
  checkbox?: Record<string, never>;
  url?: Record<string, never>;
  email?: Record<string, never>;
  phone_number?: Record<string, never>;
  formula?: { expression: string };
  relation?: {
    database_id: string;
    type: string;
    single_property?: Record<string, never>;
    dual_property?: { synced_property_name: string; synced_property_id: string };
  };
  rollup?: {
    relation_property_name: string;
    relation_property_id: string;
    rollup_property_name: string;
    rollup_property_id: string;
    function: string;
  };
  created_time?: Record<string, never>;
  created_by?: Record<string, never>;
  last_edited_time?: Record<string, never>;
  last_edited_by?: Record<string, never>;
  status?: {
    options: Array<{ id: string; name: string; color: string }>;
    groups: Array<{ id: string; name: string; color: string; option_ids: string[] }>;
  };
  unique_id?: { prefix: string | null };
  verification?: Record<string, never>;
  button?: Record<string, never>;
}

/**
 * Normalized data source property for storage
 */
export interface NotionDataSourceProperty {
  data_source_id: string;
  property_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

/**
 * Notion Page object from API (as returned from data source query)
 */
export interface NotionPage {
  object: 'page';
  id: string;
  parent: NotionParent;
  properties: Record<string, NotionPropertyValue>;
  icon?: NotionIcon | null;
  cover?: NotionCover | null;
  archived: boolean;
  in_trash: boolean;
  created_time: string;
  last_edited_time: string;
  created_by: NotionUserReference;
  last_edited_by: NotionUserReference;
  url: string;
  public_url?: string | null;
}

/**
 * Notion property value (simplified - many more types exist)
 */
export interface NotionPropertyValue {
  id: string;
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  number?: number | null;
  select?: { id: string; name: string; color: string } | null;
  multi_select?: Array<{ id: string; name: string; color: string }>;
  date?: { start: string; end?: string | null; time_zone?: string | null } | null;
  people?: Array<NotionUserReference>;
  files?: Array<
    {
      name: string;
      type: string;
      external?: { url: string };
      file?: { url: string; expiry_time: string };
    }
  >;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  formula?: {
    type: string;
    string?: string;
    number?: number;
    boolean?: boolean;
    date?: { start: string; end?: string | null };
  };
  relation?: Array<{ id: string }>;
  rollup?: {
    type: string;
    array?: unknown[];
    number?: number;
    date?: { start: string; end?: string | null };
  };
  created_time?: string;
  created_by?: NotionUserReference;
  last_edited_time?: string;
  last_edited_by?: NotionUserReference;
  status?: { id: string; name: string; color: string } | null;
  unique_id?: { prefix: string | null; number: number };
  verification?: {
    state: string;
    verified_by?: NotionUserReference;
    date?: { start: string; end?: string | null };
  } | null;
}

/**
 * Notion User object from API
 */
export interface NotionUser {
  object: 'user';
  id: string;
  type: 'person' | 'bot';
  name?: string | null;
  avatar_url?: string | null;
  // Person-specific fields
  person?: {
    email?: string;
  };
  // Bot-specific fields
  bot?: {
    owner?: {
      type: 'workspace' | 'user';
      workspace?: boolean;
      user?: NotionUserReference;
    };
    workspace_name?: string | null;
  };
}

/**
 * Notion webhook payload structure
 */
export interface NotionWebhookPayload {
  id: string; // Event ID (different from entity id)
  type: string;
  event_id?: string; // Legacy field
  timestamp: string;
  workspace_id: string;
  workspace_name?: string;
  subscription_id?: string;
  integration_id: string;
  api_version?: string;
  attempt_number?: number;
  authors?: Array<{ id: string; type: string }>;
  // Entity reference - contains the resource ID and type
  entity?: {
    id: string;
    type: string;
  };
  // Legacy fields for backward compatibility
  page_id?: string;
  data_source_id?: string;
  user_id?: string;
  data: {
    // For create events, the full object may be included
    object?: NotionDataSource | NotionPage;
    page?: NotionPage;
    data_source?: NotionDataSource;
    // For update events, partial data is included
    parent?: NotionParent & { data_source_id?: string };
    updated_properties?: string[];
    // For delete events
    deleted_object?: {
      object: string;
      id: string;
    };
  };
}

/**
 * Notion search request body
 */
export interface NotionSearchRequest {
  query?: string;
  filter?: {
    value: 'page' | 'database' | 'data_source';
    property: 'object';
  };
  sort?: {
    direction: 'ascending' | 'descending';
    timestamp: 'last_edited_time';
  };
  start_cursor?: string;
  page_size?: number;
}

/**
 * Notion data source query request body
 */
export interface NotionDataSourceQueryRequest {
  filter?: Record<string, unknown>;
  sorts?: Array<{
    property?: string;
    timestamp?: 'created_time' | 'last_edited_time';
    direction: 'ascending' | 'descending';
  }>;
  start_cursor?: string;
  page_size?: number;
}
