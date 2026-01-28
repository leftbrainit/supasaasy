/**
 * Stripe Normalization Module
 *
 * Handles entity normalization and archived state detection for Stripe objects.
 */

import type { AppConfig, NormalizedEntity } from '../../types/index.ts';
import { createNormalizedEntity } from '../utils.ts';
import { DEFAULT_API_VERSION } from './client.ts';
import { STRIPE_COLLECTION_KEYS, type StripeResourceType } from './types.ts';

// =============================================================================
// Archived State Detection
// =============================================================================

/**
 * Detect archived state for a Stripe object based on resource type
 */
export function detectArchivedAt(
  resourceType: StripeResourceType,
  data: Record<string, unknown>,
): Date | undefined {
  switch (resourceType) {
    case 'customer':
      // Customers with deleted: true should be physically deleted, not archived
      return undefined;

    case 'product':
    case 'price':
    case 'plan':
      // Products, prices, and plans use active: false for soft delete
      if (data.active === false) {
        return new Date();
      }
      return undefined;

    case 'subscription':
      // Subscriptions use status: canceled for soft delete
      if (data.status === 'canceled') {
        // Try to use canceled_at timestamp if available
        const canceledAt = data.canceled_at;
        if (typeof canceledAt === 'number') {
          return new Date(canceledAt * 1000);
        }
        return new Date();
      }
      return undefined;

    case 'subscription_item':
      return undefined;

    default:
      return undefined;
  }
}

// =============================================================================
// Entity Normalization
// =============================================================================

/**
 * Normalize a Stripe object to the canonical entity format
 */
export function normalizeStripeEntity(
  resourceType: StripeResourceType,
  data: Record<string, unknown>,
  appConfig: AppConfig,
): NormalizedEntity {
  const externalId = data.id as string;
  const collectionKey = STRIPE_COLLECTION_KEYS[resourceType];
  const archivedAt = detectArchivedAt(resourceType, data);

  return createNormalizedEntity({
    externalId,
    appKey: appConfig.app_key,
    collectionKey,
    rawPayload: data,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt,
  });
}
