/**
 * Notion Client Module
 *
 * Handles Notion API client creation and configuration helpers.
 * Uses native fetch for API calls since there's no official Notion Deno SDK.
 */

import type { AppConfig } from '../../types/index.ts';
import type { ConfigValidationError, ConfigValidationResult } from '../index.ts';
import { createConnectorLogger } from '../utils.ts';
import type {
  NotionAppConfig,
  NotionDataSource,
  NotionDataSourceQueryRequest,
  NotionPage,
  NotionPaginatedResponse,
  NotionResourceType,
  NotionSearchRequest,
  NotionUser,
} from './types.ts';

// =============================================================================
// Constants
// =============================================================================

export const CONNECTOR_NAME = 'notion';
export const CONNECTOR_VERSION = '1.0.0';
export const DEFAULT_API_VERSION = '2025-09-03';
export const DEFAULT_PAGE_SIZE = 100;
export const NOTION_API_BASE = 'https://api.notion.com';

export const logger = createConnectorLogger(CONNECTOR_NAME);

/** Valid Notion resource types */
const VALID_RESOURCE_TYPES: NotionResourceType[] = [
  'data_source',
  'data_source_property',
  'page',
  'user',
];

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Get Notion client configuration from app config
 */
export function getNotionConfig(appConfig: AppConfig): NotionAppConfig {
  return appConfig.config as NotionAppConfig;
}

/**
 * Get the Notion API key (Internal Integration Token) from environment or config
 */
export function getApiKey(appConfig: AppConfig): string {
  const config = getNotionConfig(appConfig);

  if (config.api_key_env) {
    const apiKey = Deno.env.get(config.api_key_env);
    if (apiKey) return apiKey;
  }

  if (config.api_key) {
    return config.api_key;
  }

  const defaultEnvKey = `NOTION_API_KEY_${appConfig.app_key.toUpperCase()}`;
  const defaultApiKey = Deno.env.get(defaultEnvKey);
  if (defaultApiKey) return defaultApiKey;

  throw new Error(`No Notion API key found for app ${appConfig.app_key}`);
}

/**
 * Get the webhook signing secret from environment or config
 */
export function getWebhookSecret(appConfig: AppConfig): string {
  const config = getNotionConfig(appConfig);

  if (config.webhook_secret_env) {
    const secret = Deno.env.get(config.webhook_secret_env);
    if (secret) return secret;
  }

  if (config.webhook_secret) {
    return config.webhook_secret;
  }

  const defaultEnvKey = `NOTION_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`;
  const defaultSecret = Deno.env.get(defaultEnvKey);
  if (defaultSecret) return defaultSecret;

  throw new Error(`No Notion webhook secret found for app ${appConfig.app_key}`);
}

/**
 * Get resource types to sync from config or defaults
 */
export function getResourceTypesToSync(appConfig: AppConfig): NotionResourceType[] {
  const config = getNotionConfig(appConfig);
  if (config.sync_resources && config.sync_resources.length > 0) {
    return config.sync_resources;
  }
  // Default to all resources except data_source_property (synced with data_sources)
  return ['data_source', 'page', 'user'];
}

/**
 * Get sync_from timestamp from app config if configured.
 * Returns the timestamp as an ISO 8601 string for Notion API filtering.
 */
export function getSyncFromTimestamp(appConfig: AppConfig): string | undefined {
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    logger.warn('config', `Invalid sync_from date in AppConfig: ${appConfig.sync_from}`);
  }

  const config = getNotionConfig(appConfig);
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    logger.warn('config', `Invalid sync_from date in NotionAppConfig: ${config.sync_from}`);
  }

  return undefined;
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Notion API client for making requests
 */
export interface NotionClient {
  /** Make a GET request to the Notion API */
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  /** Make a POST request to the Notion API */
  post<T>(path: string, body: unknown): Promise<T>;
  /** Search for data sources via the search API */
  searchDataSources(cursor?: string, pageSize?: number): Promise<NotionPaginatedResponse<NotionDataSource>>;
  /** Get a single data source by ID */
  getDataSource(dataSourceId: string): Promise<NotionDataSource>;
  /** Query pages from a data source */
  queryDataSource(dataSourceId: string, body?: NotionDataSourceQueryRequest): Promise<NotionPaginatedResponse<NotionPage>>;
  /** Get a single page by ID */
  getPage(pageId: string): Promise<NotionPage>;
  /** List all users */
  listUsers(cursor?: string, pageSize?: number): Promise<NotionPaginatedResponse<NotionUser>>;
  /** Get a single user by ID */
  getUser(userId: string): Promise<NotionUser>;
}

/**
 * Create a Notion API client for the given app configuration
 */
export function createNotionClient(appConfig: AppConfig): NotionClient {
  const apiKey = getApiKey(appConfig);

  /**
   * Make a request to the Notion API with rate limit handling
   */
  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    params?: Record<string, string>,
    body?: unknown,
    retries = 3,
  ): Promise<T> {
    let url = `${NOTION_API_BASE}${path}`;

    // Add query params for GET requests
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Notion-Version': DEFAULT_API_VERSION,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.debug('api', `${method} ${path}`, { params });

    const response = await fetch(url, options);

    // Handle rate limiting with exponential backoff
    if (response.status === 429 && retries > 0) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, 4 - retries) * 1000;
      logger.warn('api', `Rate limited, waiting ${waitTime}ms before retry`, { retries });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return request<T>(method, path, params, body, retries - 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Notion API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        if (errorJson.code) {
          errorMessage = `${errorJson.code}: ${errorMessage}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json() as T;
  }

  return {
    get<T>(path: string, params?: Record<string, string>): Promise<T> {
      return request<T>('GET', path, params);
    },

    post<T>(path: string, body: unknown): Promise<T> {
      return request<T>('POST', path, undefined, body);
    },

    searchDataSources(cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
      const body: NotionSearchRequest = {
        filter: {
          value: 'data_source',
          property: 'object',
        },
        page_size: pageSize,
      };
      if (cursor) {
        body.start_cursor = cursor;
      }
      return request<NotionPaginatedResponse<NotionDataSource>>('POST', '/v1/search', undefined, body);
    },

    getDataSource(dataSourceId: string) {
      return request<NotionDataSource>('GET', `/v1/data_sources/${dataSourceId}`);
    },

    queryDataSource(dataSourceId: string, body: NotionDataSourceQueryRequest = {}) {
      const requestBody: NotionDataSourceQueryRequest = {
        page_size: body.page_size ?? DEFAULT_PAGE_SIZE,
        ...body,
      };
      return request<NotionPaginatedResponse<NotionPage>>(
        'POST',
        `/v1/data_sources/${dataSourceId}/query`,
        undefined,
        requestBody,
      );
    },

    getPage(pageId: string) {
      return request<NotionPage>('GET', `/v1/pages/${pageId}`);
    },

    listUsers(cursor?: string, pageSize = DEFAULT_PAGE_SIZE) {
      const params: Record<string, string> = {
        page_size: String(pageSize),
      };
      if (cursor) {
        params.start_cursor = cursor;
      }
      return request<NotionPaginatedResponse<NotionUser>>('GET', '/v1/users', params);
    },

    getUser(userId: string) {
      return request<NotionUser>('GET', `/v1/users/${userId}`);
    },
  };
}

// =============================================================================
// Configuration Validation
// =============================================================================

/**
 * Validate Notion connector configuration
 */
export function validateNotionConfig(appConfig: AppConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const config = getNotionConfig(appConfig);

  // Validate API key configuration
  const hasApiKeyEnv = config.api_key_env && Deno.env.get(config.api_key_env);
  const hasApiKey = !!config.api_key;
  const hasDefaultApiKey = Deno.env.get(`NOTION_API_KEY_${appConfig.app_key.toUpperCase()}`);

  if (!hasApiKeyEnv && !hasApiKey && !hasDefaultApiKey) {
    errors.push({
      field: 'api_key',
      message: 'No Notion API key configured',
      suggestion: `Set ${
        config.api_key_env || `NOTION_API_KEY_${appConfig.app_key.toUpperCase()}`
      } environment variable`,
    });
  }

  // Validate webhook secret (only warn, as it's only required for webhook handling)
  const hasWebhookSecretEnv = config.webhook_secret_env && Deno.env.get(config.webhook_secret_env);
  const hasWebhookSecret = !!config.webhook_secret;
  const hasDefaultWebhookSecret = Deno.env.get(
    `NOTION_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`,
  );

  if (!hasWebhookSecretEnv && !hasWebhookSecret && !hasDefaultWebhookSecret) {
    logger.warn(
      'config',
      `No webhook secret configured for ${appConfig.app_key}. Webhook verification will fail.`,
    );
  }

  // Validate sync_resources if provided
  if (config.sync_resources && config.sync_resources.length > 0) {
    for (const resource of config.sync_resources) {
      if (!VALID_RESOURCE_TYPES.includes(resource)) {
        errors.push({
          field: 'sync_resources',
          message: `Invalid resource type: ${resource}`,
          suggestion: `Valid types are: ${VALID_RESOURCE_TYPES.join(', ')}`,
        });
      }
    }
  }

  // Validate sync_from date format if provided
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: `Invalid date format: ${config.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  // Also check AppConfig.sync_from
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: `Invalid date format in AppConfig: ${appConfig.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
