## 1. Implementation

- [x] 1.1 Create rate limiter utility with configurable limits
- [x] 1.2 Add rate limiting to webhook handler (100 req/min default)
- [x] 1.3 Add rate limiting to sync handler (10 req/min default)
- [x] 1.4 Return 429 Too Many Requests with Retry-After header when exceeded

## 2. Testing

- [x] 2.1 Verify rate limits are enforced
- [x] 2.2 Verify 429 response format is correct
