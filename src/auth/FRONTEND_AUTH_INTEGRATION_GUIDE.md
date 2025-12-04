# Auth Frontend Integration Guide

_Last reviewed: 2025-12-04_

This is the handoff for the frontend (AI) team to plug SwiftShip AI's NestJS GraphQL auth module into the web client. It also documents the current readiness and the gaps we still need to close.

## 1. What Works vs Gaps

**Shipping today**
- GraphQL mutations for `register`, `login`, `requestPasswordReset`, `resetPassword`, `changePassword`, `verifyEmail`, `resendVerificationEmail` (`src/auth/auth.resolver.ts`).
- JWT-based guard (`GqlAuthGuard`) backed by `@nestjs/passport` + `JwtStrategy` with configurable `JWT_SECRET` & expiry (`src/auth/auth.module.ts`).
- User creation stores bcrypt-hashed passwords, enforces email + password strength, and tracks `emailVerified`/tokens (`src/auth/auth.service.ts`).
- App-level throttling (`ThrottlerModule`, 120 req/min) + global validation pipe are already on (`src/app.module.ts`, `src/main.ts`).

**Known gaps to plan around**
1. Email/SMS delivery is still stubbed. `register` + `requestPasswordReset` only expose raw tokens when `NODE_ENV !== 'production'`; in production there is no fallback UI copy.
2. Guards still allow unverified users. Keep a client-side "limited" UI until we wire `emailVerified` enforcement.
3. Refresh-token revocation is per-token; we revoke on use/change-password but not on logout yet.

## 2. Endpoint & Headers

- **URL**: `POST https://<api-domain>/graphql`
- **Content-Type**: `application/json`
- **Auth header** (needed for guarded queries/mutations):
  ```http
  Authorization: Bearer <accessToken>
  ```
- **CORS**: backend accepts origins listed in `CORS_ORIGIN` env (comma-separated). Make sure the frontend domain is whitelisted before testing.

## 3. Minimal GraphQL Payloads

All payloads use the standard GraphQL request envelope:
```json
{
  "query": "mutation Login($email:String!, $password:String!) { login(email:$email, password:$password) { accessToken refreshToken user { id email name emailVerified roles { id name } } } }",
  "variables": { "email": "ops@example.com", "password": "Str0ngPass!" }
}
```

### 3.1 Register → Verify → Login
1. **Register**
   ```graphql
   mutation Register($email:String!, $password:String!, $name:String) {
     register(email:$email, password:$password, name:$name) {
       accessToken
       refreshToken
       emailVerificationToken # non-prod only, hide in UI
       user { id email emailVerified roles { name } }
     }
   }
   ```
2. **Verify email** (call backend after user clicks magic link that your frontend builds)
   ```graphql
   mutation Verify($token:String!) { verifyEmail(token:$token) { message } }
   ```
3. **Login**
   ```graphql
   mutation Login($email:String!, $password:String!) {
     login(email:$email, password:$password) {
       accessToken
       refreshToken
       user { id email name emailVerified roles { name } }
     }
   }
   ```

### 3.2 Authenticated calls
Wrap every guarded query/mutation with the `Authorization` header. Example: change password.
```graphql
mutation ChangePassword($current:String!, $next:String!) {
  changePassword(currentPassword:$current, newPassword:$next) { message }
}
```
JWT payloads now carry `userId` + `roles`, so any guard that checks roles works without client hacks.

### 3.3 Forgotten password flow
```graphql
mutation RequestReset($email:String!) {
  requestPasswordReset(email:$email) { message }
}
mutation Reset($token:String!, $new:String!) {
  resetPassword(token:$token, newPassword:$new) { message }
}
```
Store `resetToken` only in secure tooling; it only appears outside production while email is stubbed.

### 3.4 Token refresh

Use the `refreshTokens` mutation to rotate both tokens. Provide the refresh token from the last login/register/refresh response.

```graphql
mutation Refresh($token:String!) {
  refreshTokens(refreshToken:$token) {
    accessToken
    refreshToken
    user { id email roles { name } }
  }
}
```
Always replace the stored refresh token with the new one (rotation is enforced server-side).

## 4. Client Flow (Mermaid)

```mermaid
flowchart TD
  Start((User)) --> Register
  Register -->|success| Verify
  Verify --> Login
  Login --> StoreTokens[Store access + refresh tokens securely]
  StoreTokens --> AuthCall[Call guarded GraphQL ops with Authorization header]
  AuthCall --> Refresh[\nrefreshTokens mutation]
  Refresh --> StoreTokens
  AuthCall --> Logout
  Start --> ForgotPwd[Forgot password]
  ForgotPwd --> RequestReset
  RequestReset --> ResetPwd
  ResetPwd --> Login
```

Guidelines:
- Keep `accessToken` in an HTTP-only cookie/local state and `refreshToken` in a secure refresh cookie or encrypted storage. Rotate both whenever you call `refreshTokens`.
- When `login`/`register` returns `user.emailVerified=false`, keep the user in a "limited" state—some backend resolvers still allow unverified accounts.
- Expect 401/403 for any resolver decorated with `@UseGuards(GqlAuthGuard)` when the JWT expires or the refresh token is invalid. Surface a friendly session-expired banner and redirect to login.

## 5. Error Handling & Observability

- Backend uses Nest `BadRequestException`, `UnauthorizedException`, etc. Surface `graphQLErrors[0].message` to the user and log the stack.
- Global throttler returns `Too Many Requests` (429). Show a retry-after toast if the AI client hammers auth endpoints.
- Include a client-generated `x-request-id` in `extensions` if you want to correlate logs; Nest currently logs to stdout with context tags.

## 6. TODOs for Backend Alignment

1. Wire up transactional email/SMS so we can fully remove the testing-only token echoes.
2. Enforce `emailVerified` (either in guard or per resolver) to prevent unverified access.
3. Add an explicit logout mutation that revokes the active refresh token.

With refresh tokens and role-aware JWTs live, implement the flow above end-to-end and let us know if you hit any new blockers.
