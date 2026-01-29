# Change: Fix Webhook Signature Timing Attack Vulnerability

## Why

The Intercom webhook signature verification uses JavaScript's `!==` operator for comparing signatures, which is vulnerable to timing attacks. An attacker could potentially determine the correct signature by measuring response time differences across multiple requests. The Notion connector already implements constant-time comparison correctly, but Intercom does not.

## What Changes

- Add constant-time signature comparison to the connector interface specification
- **BREAKING**: Connectors MUST use constant-time comparison for all signature verification
- Remove partial signature logging that leaks information during verification failures

## Impact

- Affected specs: connector-interface
- Affected code: `packages/supasaasy/src/connectors/intercom/webhooks.ts`
