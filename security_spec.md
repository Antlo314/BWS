# Security Spec - BWS Sovereign Trust Platform

## 1. Data Invariants
- A **Transaction** document must belong to the logged-in user (`requests.auth.uid == resource.data.userId`).
- Immutable fields like `createdAt` and `userId` cannot be modified after creation.
- Field types must match standard schemas: `hash`, `trustEntity`, `allocationType`, `amount`, and `status` must be strings bounded in size.
- `status` must only transition to valid states: `'VERIFIED' | 'PROPAGATING' | 'SECURED'`.

## 2. The "Dirty Dozen" Payloads (Agressive Penetration Attempt Inputs)
1. **Unauthentic Write**: Write transaction without any auth credentials.
2. **Identity Spoofing**: Submitting with foreign `request.auth.uid`.
3. **Ghost Field Injection**: Adding unannounced fields like `adminFlag: true`.
4. **Mutate Immutable Creator ID**: Altering existing `userId` field value.
5. **Junk Hash Bomb**: Specifying a 10MB junk hash string to exhaust Firestore memory.
6. **Self-Promoted Validation**: Injecting `status` directly to terminal `"SECURED"` on create bypass.
7. **Orphaned Row Creation**: Missing crucial reference mapping properties.
8. **Negative Amount/Value Injection**: Setting allocation amount to a negative sequence or malicious code.
9. **Email Spoofing (Verification Bypass)**: Triggering write using unverified email context.
10. **Malicious Transaction ID**: Forcing `transactionId` using non-alphanumeric directory traversal string.
11. **Impersonate State Field Upgrade**: Changing transaction details other than standard status checks.
12. **Double Ledger Logging**: Spam creation of multiple identical hash operations in under 1 second.
