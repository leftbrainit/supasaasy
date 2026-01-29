## 1. Implementation

- [x] 1.1 Add constant-time comparison for admin API key in sync handler
- [x] 1.2 Add input validation for app_key format (alphanumeric, underscore, hyphen)
- [x] 1.3 Add request body size limit validation
- [x] 1.4 Return appropriate error codes for validation failures

## 2. Testing

- [x] 2.1 Verify admin key validation still works
- [x] 2.2 Verify invalid app_key formats are rejected
- [x] 2.3 Verify oversized requests are rejected
