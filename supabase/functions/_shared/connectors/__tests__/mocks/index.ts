/**
 * Shared Mock Utilities for Testing
 *
 * Provides mock factories and utilities for testing connectors and related modules.
 */

import type {
  AppConfig,
  ConnectorMetadata,
  NormalizedEntity,
  ParsedWebhookEvent,
  SupportedResource,
  SyncResult,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../../types/index.ts';
import type { Connector } from '../../index.ts';

// =============================================================================
// App Config Mocks
// =============================================================================

/**
 * Create a mock app configuration
 */
export function createMockAppConfig(
  overrides: Partial<AppConfig> = {},
): AppConfig {
  return {
    app_key: 'test_app',
    name: 'Test App',
    connector: 'mock',
    config: {},
    ...overrides,
  };
}

// =============================================================================
// Connector Mocks
// =============================================================================

/**
 * Options for creating a mock connector
 */
export interface MockConnectorOptions {
  metadata?: Partial<ConnectorMetadata>;
  verifyWebhookResult?: WebhookVerificationResult;
  parseWebhookEventResult?: ParsedWebhookEvent;
  extractEntityResult?: NormalizedEntity | null;
  normalizeEntityResult?: NormalizedEntity;
  fullSyncResult?: SyncResult;
}

/**
 * Create a mock supported resource
 */
export function createMockSupportedResource(
  overrides: Partial<SupportedResource> = {},
): SupportedResource {
  return {
    resourceType: 'test_resource',
    collectionKey: 'mock_test_resource',
    description: 'Test resource',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
    ...overrides,
  };
}

/**
 * Create mock connector metadata
 */
export function createMockConnectorMetadata(
  overrides: Partial<ConnectorMetadata> = {},
): ConnectorMetadata {
  return {
    name: 'mock',
    displayName: 'Mock Connector',
    version: '1.0.0',
    apiVersion: '2024-01-01',
    supportedResources: [createMockSupportedResource()],
    description: 'Mock connector for testing',
    ...overrides,
  };
}

/**
 * Create a mock normalized entity
 */
export function createMockNormalizedEntity(
  overrides: Partial<NormalizedEntity> = {},
): NormalizedEntity {
  return {
    externalId: 'ext_123',
    appKey: 'test_app',
    collectionKey: 'mock_test_resource',
    rawPayload: { id: 'ext_123', name: 'Test Entity' },
    apiVersion: '2024-01-01',
    ...overrides,
  };
}

/**
 * Create a mock parsed webhook event
 */
export function createMockParsedWebhookEvent(
  overrides: Partial<ParsedWebhookEvent> = {},
): ParsedWebhookEvent {
  return {
    eventType: 'create' as WebhookEventType,
    originalEventType: 'test.created',
    resourceType: 'test_resource',
    externalId: 'ext_123',
    data: { id: 'ext_123', name: 'Test Entity' },
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock sync result
 */
export function createMockSyncResult(
  overrides: Partial<SyncResult> = {},
): SyncResult {
  return {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    ...overrides,
  };
}

/**
 * Create a mock connector that implements the full Connector interface
 */
export function createMockConnector(
  options: MockConnectorOptions = {},
): Connector {
  const metadata = createMockConnectorMetadata(options.metadata);

  const verifyWebhookResult: WebhookVerificationResult = options.verifyWebhookResult ?? {
    valid: true,
    payload: { type: 'test.created', data: { id: 'ext_123' } },
  };

  const parseWebhookEventResult: ParsedWebhookEvent = options.parseWebhookEventResult ??
    createMockParsedWebhookEvent();

  const extractEntityResult: NormalizedEntity | null = options.extractEntityResult !== undefined
    ? options.extractEntityResult
    : createMockNormalizedEntity();

  const normalizeEntityResult: NormalizedEntity = options.normalizeEntityResult ??
    createMockNormalizedEntity();

  const fullSyncResult: SyncResult = options.fullSyncResult ?? createMockSyncResult();

  return {
    metadata,

    // deno-lint-ignore require-await
    async verifyWebhook(
      _request: Request,
      _config: AppConfig,
    ): Promise<WebhookVerificationResult> {
      return verifyWebhookResult;
    },

    // deno-lint-ignore require-await
    async parseWebhookEvent(
      _payload: unknown,
      _config: AppConfig,
    ): Promise<ParsedWebhookEvent> {
      return parseWebhookEventResult;
    },

    // deno-lint-ignore require-await
    async extractEntity(
      _event: ParsedWebhookEvent,
      _config: AppConfig,
    ): Promise<NormalizedEntity | null> {
      return extractEntityResult;
    },

    normalizeEntity(
      _resourceType: string,
      _data: Record<string, unknown>,
      _config: AppConfig,
    ): NormalizedEntity {
      return normalizeEntityResult;
    },

    // deno-lint-ignore require-await
    async fullSync(_config: AppConfig): Promise<SyncResult> {
      return fullSyncResult;
    },
  };
}

// =============================================================================
// Spy/Mock Tracking Utilities
// =============================================================================

/**
 * Call tracker for mocking functions
 */
export interface CallTracker<T extends unknown[], R> {
  /** All calls made to the tracked function */
  calls: T[];
  /** Number of times the function was called */
  callCount: number;
  /** The tracked function */
  fn: (...args: T) => R;
  /** Reset the tracker */
  reset: () => void;
}

/**
 * Create a call tracker that records function calls
 */
export function createCallTracker<T extends unknown[], R>(
  returnValue: R,
): CallTracker<T, R> {
  const calls: T[] = [];

  return {
    calls,
    get callCount() {
      return calls.length;
    },
    fn: (...args: T): R => {
      calls.push(args);
      return returnValue;
    },
    reset: () => {
      calls.length = 0;
    },
  };
}

/**
 * Create an async call tracker
 */
export function createAsyncCallTracker<T extends unknown[], R>(
  returnValue: R,
): CallTracker<T, Promise<R>> {
  const calls: T[] = [];

  return {
    calls,
    get callCount() {
      return calls.length;
    },
    fn: (...args: T): Promise<R> => {
      calls.push(args);
      return Promise.resolve(returnValue);
    },
    reset: () => {
      calls.length = 0;
    },
  };
}

// =============================================================================
// Request Mocks
// =============================================================================

/**
 * Create a mock HTTP request
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}): Request {
  const { method = 'POST', url = 'https://example.com/webhook', headers = {}, body = '{}' } =
    options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body,
  });
}

/**
 * Create a mock webhook request with signature header
 */
export function createMockWebhookRequest(options: {
  body?: string;
  signature?: string;
  signatureHeader?: string;
} = {}): Request {
  const { body = '{}', signature = 'test_signature', signatureHeader = 'x-webhook-signature' } =
    options;

  return createMockRequest({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [signatureHeader]: signature,
    },
    body,
  });
}
