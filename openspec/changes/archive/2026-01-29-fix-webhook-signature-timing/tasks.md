## 1. Implementation

- [x] 1.1 Add `constantTimeEqual` helper function to Intercom webhooks module (similar to Notion)
- [x] 1.2 Replace `!==` comparison with `constantTimeEqual` in `verifyWebhook` function
- [x] 1.3 Remove signature value logging (truncated signatures still leak information)
- [x] 1.4 Add unit tests for constant-time comparison function (existing tests cover verification)
- [x] 1.5 Verify webhook signature verification still works correctly

## 2. Documentation

- [x] 2.1 Update any relevant inline comments about signature comparison
