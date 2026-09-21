# Tempelink — Security Architecture & SSRF Defense

## 1. Threat Modeling & Attack Vectors

Universal media downloaders handle untrusted user-supplied URLs, making them high-value targets for:
1. **Server-Side Request Forgery (SSRF)**: Attackers submitting `http://169.254.169.254/latest/meta-data/` to compromise cloud infrastructure, or `http://127.0.0.1:6379` / internal LAN services.
2. **Denial of Service (DoS) / Resource Exhaustion**: Users flooding requests with massive video streams to exhaust bandwidth or memory.
3. **Malicious Redirects & Protocol Poisoning**: Using `file://`, `gopher://`, or malicious open-redirect chains.
4. **Credential Leakage**: Upstream API keys or session cookies accidentally passed to client browsers.

---

## 2. SSRF Mitigation Engine

Tempelink implements a strict, multi-tiered SSRF barrier in `src/lib/security/ssrf.ts`:

### 2.1. Protocol Enforcement
- Only `http:` and `https:` schemes are permitted.
- Disallows all other schemes (`file:`, `ftp:`, `gopher:`, `data:`, `javascript:`).

### 2.2. Address Range Blacklisting
Any host resolving to the following ranges is immediately dropped and flagged as `SSRF_BLOCKED`:
- **IPv4 Loopback**: `127.0.0.0/8`
- **IPv6 Loopback**: `::1`
- **RFC 1918 Private Address Space**:
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
- **Link-Local & Cloud Metadata**:
  - `169.254.0.0/16` (Specifically AWS/GCP/Azure metadata `169.254.169.254`)
  - `fe80::/10` (IPv6 Link-Local)
- **Carrier-Grade NAT**:
  - `100.64.0.0/10`

### 2.3. Hostname Allowlisting & Domain Resolution
The URL resolver does not execute generic `fetch(userUrl)`. Instead:
1. The URL must match a recognized provider domain pattern.
2. If an unknown domain is submitted, it is rejected at the detector layer as `UNSUPPORTED_PLATFORM` before any outbound network socket is established.
3. If a redirect is encountered during media resolution, each hop is re-validated through the SSRF filter.

---

## 3. Rate Limiting Architecture

Tempelink employs a sliding window counter algorithm implemented in `src/lib/rate-limit/`:

### Default Limits:
- **Anonymous URL Resolution**: 20 requests per minute per IP address.
- **Anonymous Download Initiation**: 10 requests per minute per IP address.
- **Cooldown Penalty**: Exceeding the limit results in an exponential cooldown period (429 Too Many Requests).

### Architecture Pluggability:
Phase 1 uses an in-memory sliding window cache. The interface (`RateLimiterStore`) is intentionally architected to be a drop-in replacement for Redis (`ioredis` or Upstash) in Phase 2 for distributed multi-region deployments.

---

## 4. Secrets Management & Environment Isolation

- Server secrets (provider API credentials, encryption keys, internal rate limit tokens) are kept strictly in server-side environment variables (`.env`).
- No secret is ever prefixed with `NEXT_PUBLIC_`.
- Sanitization guards ensure raw upstream headers, tokens, and authorization cookies are stripped from all public API outputs.

---

## 5. Stateless Signed Download Tokens & Anti-Tampering

To completely eliminate SSRF and open proxy vulnerabilities through `/api/media/download`:
1. **Never Accept Arbitrary URLs**: The download endpoint never accepts user-provided media URLs.
2. **HMAC-SHA256 Token Signature**: During resolution, each valid capability's target URL is signed with `DOWNLOAD_SIGNING_SECRET`.
3. **Timing-Safe Verification**: Signatures are checked using `crypto.timingSafeEqual`. Tampered or forged tokens are dropped with `SSRF_BLOCKED` (HTTP 403).
4. **Enforced Expiration**: Tokens expire after 15 minutes (`DOWNLOAD_TOKEN_EXPIRY_SECONDS`), returning `MEDIA_URL_EXPIRED` (HTTP 410).
5. **Secondary SSRF Boundary**: Even after a token's signature is verified, `validateUrlSafety` runs against the decoded target URL to guarantee no link targets internal or cloud metadata IP ranges.

---

## 6. Production Secret Hardening & Fail-Closed Enforcement

- In Phase 2.5, `src/lib/config.ts` enforces a strict fail-closed boundary for `DOWNLOAD_SIGNING_SECRET`.
- When `NODE_ENV === 'production'`:
  - If `DOWNLOAD_SIGNING_SECRET` is unset, empty, or equals the development fallback (`tempelink_dev_secret_signing_key_32_chars`), or is shorter than 32 characters, the application throws `INTERNAL_ERROR`.
  - The production server refuses to sign or verify tokens with insecure or default keys.
  - Client bundles never receive `DOWNLOAD_SIGNING_SECRET`.

---

## 7. Download Delivery Hardening & Injection Defenses (Phase 3)

### 7.1. Filename Sanitization & Directory Traversal Prevention
- All filenames generated during token creation and download routing are sanitized by `sanitizeDownloadFilename()`:
  - **CRLF Injection**: Strips `\r`, `\n`, null bytes `\0`, and control characters `\x00-\x1f\x7f`.
  - **Directory Traversal**: Strips `../`, `..\`, leading `/`, and normalizes separators to `_`.
  - **Illegal Characters**: Replaces `< > : " / \ | ? * ; $ ` & !` with underscores.
  - **Windows Reserved Names**: Prefixes dangerous device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) with `file_`.
  - **Buffer Bounds**: Truncates base filename to maximum 80 characters before extension.

### 7.2. RFC 6266 & RFC 5987 Header Compliance
- The `Content-Disposition` response header is formatted by `formatContentDisposition()`:
  - Emits ASCII-safe fallback: `attachment; filename="<ascii>"`
  - Emits UTF-8 encoded parameter for non-ASCII characters: `filename*=UTF-8''<encoded>`
  - Strictly prevents header line breaks.

### 7.3. Anti-Caching & MIME Whitelisting
- All download delivery responses include:
  - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
  - `Pragma: no-cache`
  - `Expires: 0`
  - `X-Content-Type-Options: nosniff`
- Download tokens strictly validate MIME types against `ALLOWED_MEDIA_MIME_TYPES`. Unwhitelisted types (such as `text/html`, `application/javascript`, `application/x-sh`) are rejected with `UNSUPPORTED_MEDIA` (HTTP 422).


