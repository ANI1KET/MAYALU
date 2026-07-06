# 02 — Authentication Flow

## OTP → JWT → Cookie Flow

```
1. POST /auth/otp/send { phone, purpose }
   ├─ Rate check: 60s cooldown per phone+purpose
   ├─ Generate: crypto.randomBytes → 6-digit OTP
   ├─ Hash: argon2id(otp, { memoryCost:4096, timeCost:1 })
   ├─ Store: otp_tokens { phone, codeHash, purpose, expiresAt=+5min, attempts=0 }
   └─ SMS: Sparrow SMS Nepal → phone

2. POST /auth/otp/verify { phone, otp, purpose }
   ├─ Lookup: valid record (phone+purpose+expires>now+usedAt=null)
   ├─ Check: attempts < 3  →  throw OTP_MAX_ATTEMPTS
   ├─ Verify: argon2.verify(record.codeHash, otp)
   │    └─ Wrong: increment attempts, throw INVALID_OTP
   ├─ Mark: usedAt = NOW()
   ├─ Upsert user: create if new, set isPhoneVerified=true
   ├─ Check: user.status ≠ 'suspended'
   ├─ Issue: TokenService.issuePair(userId, phone, { ip, userAgent })
   └─ Set cookies (HttpOnly, Secure, SameSite=Strict):
       access_token  → Path=/, maxAge=900s (15min)
       refresh_token → Path=/api/v1/auth/refresh, maxAge=2592000s (30d)
```

## Token Structure

```
Access Token (JWT HS256):
{
  "sub": "user-uuid",
  "phone": "+9779841234567",
  "type": "access",
  "iss": "mayalu-wears",
  "aud": "mayalu-wears-app",
  "iat": 1700000000,
  "exp": 1700000900   ← 15 minutes
}

Refresh Token (opaque):
  Raw:   crypto.randomBytes(48).toString('hex')  → 96-char hex
  Stored: sha256(raw) in refresh_tokens.tokenHash
```

## Token Rotation (Theft Detection)

```
POST /auth/refresh (cookie: refresh_token)
  │
  ├─ sha256(raw) → lookup tokenHash
  ├─ Not found?        → INVALID_REFRESH_TOKEN
  ├─ revokedAt set?    → REFRESH_TOKEN_REVOKED
  ├─ expiresAt < now?  → REFRESH_TOKEN_EXPIRED
  ├─ isUsed = true?    → ⚠️  REUSE DETECTED
  │    ├─ Revoke entire family (familyId)
  │    └─ Throw 403 REFRESH_TOKEN_REUSE_DETECTED
  │
  ├─ Mark old token: isUsed = true
  └─ Issue new pair (same familyId, new token)
```

**Why family-based revocation?**  
If an attacker steals a refresh token and uses it after the legitimate user has already rotated it, presenting the *used* token triggers revocation of every token in that family — forcing all sessions to re-authenticate. This defeats token theft even when the attacker acts after the legitimate user.

## Cookie Security

| Flag | Value | Reason |
|------|-------|--------|
| `httpOnly` | true | JavaScript cannot read → XSS safe |
| `secure` | true (prod) | HTTPS only |
| `sameSite` | strict | No cross-site requests → CSRF primary defence |
| `path` (refresh) | `/api/v1/auth/refresh` | Refresh token never sent on other routes |

## Guard Logic

```typescript
AuthGuard.canActivate():
  1. Check @Public() decorator → skip if set
  2. Extract token: cookie first, then Authorization header
  3. jose.jwtVerify(token, secret, { issuer, audience })
  4. Verify payload.type === 'access'
  5. Attach payload to request.user
  6. Zero DB reads on every auth check (JWT is self-contained)
```

## Admin Authentication

Admin endpoints use `X-Admin-Key: <secret>` header (separate from user JWT). The key is validated against `ADMIN_SECRET_KEY` env var (min 16 chars). There are no admin JWT sessions — the key is a shared secret for internal tooling.
