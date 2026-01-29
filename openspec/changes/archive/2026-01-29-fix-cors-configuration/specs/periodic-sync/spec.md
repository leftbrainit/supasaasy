## ADDED Requirements

### Requirement: CORS Configuration

The sync endpoint SHALL have restrictive CORS settings appropriate for server-to-server communication.

#### Scenario: CORS restricted

- **WHEN** the sync endpoint responds to requests
- **THEN** CORS headers SHALL NOT use wildcard origins
- **AND** CORS SHALL only be enabled for preflight OPTIONS requests
- **AND** API clients SHALL authenticate with Bearer tokens instead of relying on CORS
