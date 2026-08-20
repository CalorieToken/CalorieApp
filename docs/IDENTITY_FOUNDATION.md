# CalorieApp V2.0 Identity Foundation

## Architecture Overview

CalorieApp V2.0 introduces a secure identity foundation that leverages WordPress's existing XUMM Login authentication while providing independent application-level user management.

### Key Design Principles

1. **Do NOT replace XUMM Login 1.3.0** - WordPress remains the authoritative source for Xaman/XRPL address verification
2. **Application-level identity** - CalorieApp maintains its own internal user model independent of WordPress
3. **Server-to-server bridge** - Secure identity exchange through short-lived authorization codes
4. **Privacy by default** - XRPL address is private and only exposed when explicitly needed
5. **Non-financial architecture** - CalorieApp is purely a nutrition tracking application (V1 scope)

## Data Model

### CalorieAppUser

The internal user identity in CalorieApp.

```sql
Table: calorieappuser
- id: UUID (primary key)
- created_at: DateTime (UTC)
- updated_at: DateTime (UTC)
- status: String (default: "active")
```

Purpose: Immutable, internal user identifier. Never exposed to frontend.

### ExternalIdentity

Links a CalorieAppUser to an external authentication provider (WordPress/XUMM).

```sql
Table: externalidentity
- id: UUID (primary key)
- calorieapp_user_id: UUID (foreign key → calorieappuser.id)
- provider: String (e.g., "wordpress_xumm")
- external_subject: String (e.g., WordPress user ID)
- xrpl_address: String (nullable, e.g., "rN7n7otQDd6...")
- created_at: DateTime (UTC)
- last_verified_at: DateTime (UTC)

Unique constraint: (provider, external_subject) = unique
```

Purpose: Maintains mapping between internal and external identities. Supports future authentication providers.

### AuthorizationCode

One-time authorization code for the identity exchange flow.

```sql
Table: authorizationcode
- id: UUID (primary key)
- code_hash: String (SHA256, unique)
- external_subject: String (WordPress user ID)
- xrpl_address: String (nullable)
- state: String (CSRF protection)
- login_session_id: String (login attempt ID)
- created_at: DateTime (UTC)
- expires_at: DateTime (UTC)
- used_at: DateTime (nullable)
- used_by_ip: String (nullable)
```

Purpose: Prevents replay attacks, enforces single-use semantics, enables state validation.

## Authentication Flow

### Step 1: Login Initiation (Frontend → Backend)

```
POST /api/identity/login/start
Response:
{
  "login_session_id": "uuid-123",
  "state": "state-value-456",
  "wordpress_auth_url": "https://calorietoken.net/wp-login.php?..."
}
```

CalorieApp backend generates:
- `login_session_id`: Unique identifier for this login attempt
- `state`: CSRF token stored in frontend session
- `wordpress_auth_url`: Redirect URL to WordPress

### Step 2: WordPress Authentication (Frontend → WordPress → Xaman)

Browser redirects to `wordpress_auth_url`. User authenticates with Xaman via XUMM Login plugin.

WordPress extracts verified XRPL address from Xaman response and stores in WordPress user metadata: `xrpl-r-address`

### Step 3: WordPress Bridge Redirect (WordPress → Frontend)

WordPress companion bridge plugin:
1. Detects authenticated WordPress user
2. Reads `xrpl-r-address` metadata server-side
3. Generates short-lived (60s) authorization code
4. Redirects to CalorieApp callback:
   ```
   GET https://app.calorietoken.net/auth/callback?code=XXXX&state=YYY
   ```

### Step 4: Code Exchange (Frontend → Backend)

Frontend submits authorization code:
```
POST /api/identity/callback
{
  "code": "authorization-code-12345",
  "state": "state-value-456"
}
```

CalorieApp backend validates code and exchanges for identity claims (server-to-server with WordPress).

### Step 5: User Creation/Retrieval

If external identity exists:
```
CalorieAppUser (existing) ← ExternalIdentity ← identity claims
```

If new identity:
```
ExternalIdentity (new) → CalorieAppUser (new) ← identity claims
```

### Step 6: Session Creation

CalorieApp backend creates authenticated session:
```
Set-Cookie: calorieapp_user_id=<user_id>; Secure; HttpOnly; SameSite=Strict
```

Returns success response. Frontend redirects to authenticated home page.

## API Endpoints

### Identity Endpoints (Public)

#### `POST /api/identity/login/start`

Initiates the login flow. Returns login session ID, state, and WordPress auth URL.

**No authentication required**

Response:
```json
{
  "login_session_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "random-state-value-12345",
  "wordpress_auth_url": "https://calorietoken.net/wp-login.php?..."
}
```

#### `POST /api/identity/callback`

Callback endpoint where WordPress bridge redirects after authentication.

**No authentication required**

Request:
```json
{
  "code": "authorization-code-from-wordpress",
  "state": "state-value-from-login-start"
}
```

Response (on success):
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "authenticated"
}
```

Sets session cookie: `calorieapp_user_id`

### Identity Endpoints (Authenticated)

#### `GET /api/identity/me`

Get current authenticated user information.

**Requires session cookie**

Response:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-08-20T10:30:00Z"
}
```

#### `POST /api/identity/logout`

Invalidate current session. Does NOT log out of WordPress/XUMM.

**Requires session cookie**

Response:
```json
{
  "message": "Logged out successfully"
}
```

Clears `calorieapp_user_id` cookie.

### Food Log Endpoints (Authenticated)

All food log endpoints now require authentication.

- `POST /log-food` - Log a food item (requires auth)
- `GET /logs` - Retrieve user's food logs (requires auth)
- `DELETE /logs/{id}` - Delete a specific log entry (requires auth)
- `DELETE /logs` - Delete all log entries (requires auth)

Food logs are associated with the authenticated user via `owner_id`.

**Migration note**: Existing V1.2 food logs without `owner_id` remain readable by authenticated users (support backward compatibility).

## Server-to-Server Authentication (WordPress ↔ CalorieApp)

The WordPress companion bridge and CalorieApp backend use mutual authentication:

### Authentication Method

**Recommended**: HMAC-SHA256 with rotating keys stored in environment variables

```python
# CalorieApp backend
WORDPRESS_BRIDGE_SECRET = os.getenv("WORDPRESS_BRIDGE_SECRET")

# WordPress .env
CALORIEAPP_CLIENT_ID = getenv("CALORIEAPP_CLIENT_ID", "calorieapp-backend")
CALORIEAPP_CLIENT_SECRET = getenv("CALORIEAPP_CLIENT_SECRET")  # Same as WORDPRESS_BRIDGE_SECRET
```

### Code Exchange Flow

1. Frontend receives `code` from WordPress
2. Frontend submits to CalorieApp: `POST /api/identity/callback`
3. CalorieApp backend calls WordPress bridge server-to-server:
   ```
   POST https://calorietoken.net/wp-json/xummlogin/v1/exchange
   Headers:
     - X-Client-Id: calorieapp-backend
     - X-Signature: HMAC-SHA256(payload, WORDPRESS_BRIDGE_SECRET)
   Body:
     {
       "code": "authorization-code",
       "nonce": "unique-request-id"
     }
   ```
4. WordPress bridge verifies signature and code validity
5. WordPress returns verified identity claims:
   ```json
   {
     "external_subject": "wordpress_user_123",
     "xrpl_address": "rN7n7otQDd6FczFgLdlqtyMVrDHdH6s4vg",
     "issued_at": "2026-08-20T10:30:00Z",
     "expires_at": "2026-08-20T10:35:00Z",
     "jti": "unique-issuance-id"
   }
   ```
6. CalorieApp creates/updates user and establishes session

## Environment Variables

### CalorieApp Backend

```bash
# Database
DATABASE_URL=sqlite:///backend/calorieapp.db

# CORS
CORS_ORIGINS=https://app.calorietoken.net,https://app-staging.calorietoken.net

# WordPress Integration
WORDPRESS_URL=https://calorietoken.net
WORDPRESS_BRIDGE_SECRET=your-shared-secret-here  # CRITICAL: Store securely

# CalorieApp Identity
CALORIEAPP_CLIENT_ID=calorieapp-backend
CALORIEAPP_CALLBACK_URL=https://app.calorietoken.net/auth/callback
```

### WordPress (Companion Plugin)

```bash
# .env or wp-config.php constants
define("CALORIEAPP_CLIENT_ID", "calorieapp-backend");
define("CALORIEAPP_CLIENT_SECRET", "your-shared-secret-here");  # Must match WORDPRESS_BRIDGE_SECRET
define("CALORIEAPP_CALLBACK_URL", "https://app.calorietoken.net/auth/callback");
```

## Security Considerations

### Implemented Protections

1. **Authorization Code**
   - Cryptographically random, high-entropy
   - Single-use only (replay protected)
   - Short-lived (60 seconds default)
   - Hash stored (not plaintext)

2. **CSRF Protection**
   - State parameter required for every login
   - Frontend generates state before redirect
   - State verified upon callback

3. **Session Security**
   - HttpOnly cookies (prevent JS access)
   - Secure flag (HTTPS only in production)
   - SameSite=Strict (CSRF prevention)
   - Per-request session validation

4. **Server-to-Server Security**
   - HMAC-SHA256 request signing
   - Secrets stored in environment variables
   - HTTPS only
   - Nonce/jti prevents replay

5. **Information Disclosure**
   - XRPL address never returned to frontend unless explicitly requested
   - WordPress auth cookie never shared with CalorieApp
   - XUMM API Secret never exposed outside WordPress
   - Minimal identity claims returned

### NOT Implemented (Requires WordPress Plugin)

- WordPress companion bridge authentication endpoint
- Authorization code generation on WordPress side
- XRPL address metadata reads from WordPress

These are handled by a separate WordPress plugin (not included in CalorieApp repository).

## Testing

All identity functionality has comprehensive test coverage:

### Unit Tests (test_identity.py)

- Authorization code generation and hashing
- Code validation and expiration
- Replay attack prevention
- State parameter validation
- Login session validation
- User creation and retrieval
- External identity association

### Integration Tests (test_identity_endpoints.py)

- Login flow endpoint
- Callback endpoint
- Authenticated user retrieval
- Logout functionality
- Food log authentication requirements
- Authenticated food log operations

Run tests:
```bash
pytest backend/tests/ -v
```

All 61 tests pass ✓

## Migration from V1.2

### Existing Food Logs

- Not destroyed or invalidated
- `owner_id` field remains nullable initially
- Unauthenticated users cannot access them
- Authenticated users can see both owned and legacy logs (during transition)
- Future: Explicit migration path for ownership assignment

### Database Migration

No complex migrations needed:
1. SQLModel creates new tables on startup
2. Existing `food_log` table remains unchanged
3. New `calorieappuser`, `externalidentity`, `authorizationcode` tables created
4. Optional columns added to `food_log` via `ALTER TABLE` helper

## Development Setup (Local)

### Prerequisites

- Python 3.12+
- FastAPI, SQLModel, Pydantic installed
- Virtual environment configured

### Local Development Database

```bash
# Database created automatically on first run
# Located at: backend/calorieapp.db

# Clear for testing
rm backend/calorieapp.db
```

### Run Local Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### Local Frontend Configuration

```javascript
// frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WORDPRESS_URL=http://localhost:8080  // or production WordPress
```

### Bypass Authentication (Development Only)

For local development without WordPress:
1. Manually create user in test database
2. Set session cookie: `calorieapp_user_id=<user_id>`
3. Access authenticated endpoints

## Deployment Checklist

- [ ] Set `WORDPRESS_BRIDGE_SECRET` in production environment
- [ ] Set `WORDPRESS_URL` to production WordPress domain
- [ ] Set `CALORIEAPP_CALLBACK_URL` to production frontend URL
- [ ] Set `CORS_ORIGINS` to production frontend domain
- [ ] Configure HTTPS everywhere
- [ ] Verify WordPress companion plugin is installed and configured
- [ ] Test login flow end-to-end
- [ ] Monitor logs for auth errors
- [ ] Set up database backups
- [ ] Document any custom environment variables

## Future Enhancements

### Not Implemented in V2.0

- Public profiles / social features
- Leaderboards
- NFTs / blockchain integration
- IPFS usage
- BigchainDB logging
- DAO / voting
- Multi-device session management
- OAuth2 / OpenID Connect (for third-party apps)
- Passwordless email login
- Two-factor authentication

### Design Reserved For Future

- Alternative identity providers (Google, Apple, etc.)
- Federated identity protocol support
- Decentralized identity (DIDs)
- Verifiable credentials

## Support and Troubleshooting

### Common Issues

**Login redirect fails**
- Verify `WORDPRESS_URL` is correct
- Check `WORDPRESS_BRIDGE_SECRET` matches on both sides
- Ensure HTTPS is configured

**State mismatch error**
- Frontend state not preserved across redirects
- Check session storage is working
- Verify CORS is allowing credentials

**Authorization code expired**
- Code lifetime is 60 seconds
- Network delay or browser delay
- Increase timeout if needed (requires code change)

**User not found after auth**
- Check WordPress bridge plugin installed
- Verify `xrpl-r-address` metadata exists in WordPress
- Ensure external_subject format matches (usually WordPress user ID)

## References

- XUMM Login Plugin: https://github.com/xrpfactchecker/xummlogin
- XRPL Sign-In: https://xrpl.org/xrpl-signers/
- FastAPI Docs: https://fastapi.tiangolo.com/
- SQLModel: https://sqlmodel.tiangolo.com/

---

**Last Updated**: 2026-08-20
**Version**: 2.0.0
**Status**: Identity Foundation Implemented ✓
