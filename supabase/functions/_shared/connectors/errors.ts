/**
 * Connector Error Types
 *
 * Consistent error types for connector failure scenarios.
 */

/**
 * Base error class for all connector-related errors
 */
export class ConnectorError extends Error {
  /** The connector that threw the error */
  readonly connector: string;
  /** Whether this error is retryable */
  readonly retryable: boolean;

  constructor(
    message: string,
    connector: string,
    retryable = false
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.connector = connector;
    this.retryable = retryable;
  }
}

/**
 * Error thrown when webhook signature verification fails
 */
export class WebhookVerificationError extends ConnectorError {
  /** The reason verification failed */
  readonly reason: string;

  constructor(
    connector: string,
    reason: string
  ) {
    super(`Webhook verification failed: ${reason}`, connector, false);
    this.name = 'WebhookVerificationError';
    this.reason = reason;
  }
}

/**
 * Error thrown when the SaaS API returns a rate limit error
 */
export class RateLimitError extends ConnectorError {
  /** Seconds until the rate limit resets */
  readonly retryAfterSeconds: number;
  /** Timestamp when rate limit resets */
  readonly resetAt: Date;

  constructor(
    connector: string,
    retryAfterSeconds: number,
    message?: string
  ) {
    super(
      message || `Rate limit exceeded, retry after ${retryAfterSeconds}s`,
      connector,
      true
    );
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.resetAt = new Date(Date.now() + retryAfterSeconds * 1000);
  }
}

/**
 * Error thrown when an API request fails
 */
export class ApiError extends ConnectorError {
  /** HTTP status code if applicable */
  readonly statusCode?: number;
  /** Raw error response from the API */
  readonly response?: unknown;

  constructor(
    connector: string,
    message: string,
    statusCode?: number,
    response?: unknown
  ) {
    // 5xx errors and some 4xx are typically retryable
    const retryable = statusCode
      ? statusCode >= 500 || statusCode === 429 || statusCode === 408
      : false;

    super(message, connector, retryable);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Error thrown when an entity referenced in a webhook no longer exists
 */
export class EntityNotFoundError extends ConnectorError {
  /** The external ID of the missing entity */
  readonly externalId: string;
  /** The resource type */
  readonly resourceType: string;

  constructor(
    connector: string,
    externalId: string,
    resourceType: string
  ) {
    super(
      `Entity not found: ${resourceType}/${externalId}`,
      connector,
      false
    );
    this.name = 'EntityNotFoundError';
    this.externalId = externalId;
    this.resourceType = resourceType;
  }
}

/**
 * Error thrown when entity normalization fails
 */
export class NormalizationError extends ConnectorError {
  /** The resource type being normalized */
  readonly resourceType: string;
  /** The field that caused the error (if known) */
  readonly field?: string;

  constructor(
    connector: string,
    resourceType: string,
    message: string,
    field?: string
  ) {
    super(
      `Normalization failed for ${resourceType}: ${message}`,
      connector,
      false
    );
    this.name = 'NormalizationError';
    this.resourceType = resourceType;
    this.field = field;
  }
}

/**
 * Error thrown when connector configuration is invalid
 */
export class ConfigurationError extends ConnectorError {
  /** The configuration field that is invalid */
  readonly field?: string;

  constructor(
    connector: string,
    message: string,
    field?: string
  ) {
    super(message, connector, false);
    this.name = 'ConfigurationError';
    this.field = field;
  }
}

/**
 * Type guard to check if an error is a ConnectorError
 */
export function isConnectorError(error: unknown): error is ConnectorError {
  return error instanceof ConnectorError;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ConnectorError) {
    return error.retryable;
  }
  return false;
}

/**
 * Extract retry-after seconds from an error if available
 */
export function getRetryAfterSeconds(error: unknown): number | undefined {
  if (error instanceof RateLimitError) {
    return error.retryAfterSeconds;
  }
  return undefined;
}
