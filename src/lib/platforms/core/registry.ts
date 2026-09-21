import { PlatformProvider, PlatformInfo } from '../../types/provider';
import { TikTokProvider } from '../providers/tiktok';
import { InstagramProvider } from '../providers/instagram';
import { YouTubeProvider } from '../providers/youtube';
import { XProvider } from '../providers/x';
import { FacebookProvider } from '../providers/facebook';
import { PinterestProvider } from '../providers/pinterest';

export class ProviderRegistry {
  private providers: Map<string, PlatformProvider> = new Map();

  constructor() {
    // Automatically register initial ecosystem providers
    this.register(new TikTokProvider());
    this.register(new InstagramProvider());
    this.register(new YouTubeProvider());
    this.register(new XProvider());
    this.register(new FacebookProvider());
    this.register(new PinterestProvider());
  }

  public register(provider: PlatformProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  public get(id: string): PlatformProvider | undefined {
    return this.providers.get(id.toLowerCase());
  }

  public findForUrl(url: URL): PlatformProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    return undefined;
  }

  public getAll(): PlatformProvider[] {
    return Array.from(this.providers.values());
  }

  public getPlatformInfos(): PlatformInfo[] {
    return this.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      status: 'operational',
      supportedMedia: p.supportedMediaTypes,
      exampleUrl: p.exampleUrl,
    }));
  }
}

// Global singleton instance
export const providerRegistry = new ProviderRegistry();
