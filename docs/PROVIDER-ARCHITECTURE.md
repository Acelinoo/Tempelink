# Tempelink — Provider Architecture

## 1. Provider Abstraction Rationale

In universal media downloaders, coupling platform extraction logic directly to the API or frontend causes cascading failures whenever an individual platform updates its endpoints or markup. 

Tempelink enforces a strict **Provider Abstraction Barrier**:
1. Providers are self-contained plugins implementing a uniform TypeScript contract.
2. Providers never interact with the HTTP response or React state directly.
3. Providers receive a normalized `URL` and return an internal `MediaResolution` object or throw a structured `TempelinkError`.

---

## 2. The PlatformProvider Contract

```typescript
export interface PlatformProvider {
  /**
   * Unique machine identifier for the provider (e.g., 'tiktok', 'youtube')
   */
  readonly id: string;

  /**
   * Human-readable name for UI badges and diagnostics (e.g., 'TikTok')
   */
  readonly name: string;

  /**
   * List of supported domain patterns (e.g., ['tiktok.com', 'vm.tiktok.com'])
   */
  readonly supportedDomains: string[];

  /**
   * Quick predicate to test if this provider can handle the given URL.
   */
  canHandle(url: URL): boolean;

  /**
   * Inspects the URL to extract platform-specific entities (media type, ID).
   */
  detect(url: URL): DetectionResult;

  /**
   * Resolves the media metadata and extracts valid capabilities.
   * Throws TempelinkError if resolution fails or content is inaccessible.
   */
  resolve(url: URL, context?: ProviderContext): Promise<MediaResolution>;
}
```

---

## 3. Provider Lifecycle & Execution Flow

```
[ Incoming Request ]
        │
        ▼
[ PlatformDetector.getProvider(url) ]
        │
        ├─ Match domain & path against registered providers
        │
        ▼
[ Provider.resolve(url) ]
        │
        ├─ Fetch public metadata / API endpoint (with SSRF guard)
        ├─ Validate content accessibility (check for private/deleted/region restriction)
        ├─ Parse available media streams
        ├─ Construct MediaResolution internal object
        │
        ▼
[ CapabilityNormalizer.normalize(resolution) ]
        │
        ├─ Map resolutions to 'standard' vs 'hd'
        ├─ Validate file formats (mp4, webm, mp3, etc.)
        ├─ Strip provider internal tokens / session identifiers
        │
        ▼
[ Return PublicMediaResponse ]
```

---

## 4. Provider Registry

Providers are registered in a centralized singleton registry:
```typescript
class ProviderRegistry {
  private providers: Map<string, PlatformProvider> = new Map();

  register(provider: PlatformProvider): void;
  get(id: string): PlatformProvider | undefined;
  findForUrl(url: URL): PlatformProvider | undefined;
  getAll(): PlatformProvider[];
}
```

This architecture enables:
- Seamless addition of new providers (e.g., Threads, Reddit, Vimeo) simply by creating a new class and registering it.
- Independent mocking and unit testing without launching full web servers.
- Dynamic enabling/disabling of providers during maintenance without touching core routing.
