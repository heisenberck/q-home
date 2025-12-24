
import { get, set } from 'idb-keyval';

const TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'qhome_cache_v2_';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class CacheManager {
    private memoryCache: Map<string, CacheEntry<any>> = new Map();

    async get<T>(key: string): Promise<T | null> {
        // 1. Try Memory First (Fastest)
        const inMem = this.memoryCache.get(key);
        if (inMem && (Date.now() - inMem.timestamp < TTL)) {
            return inMem.data;
        }

        // 2. Try IndexedDB (Persistent)
        const inDB = await get<CacheEntry<T>>(CACHE_PREFIX + key);
        if (inDB) {
            // Populate memory for next time
            this.memoryCache.set(key, inDB);
            
            if (Date.now() - inDB.timestamp < TTL) {
                return inDB.data;
            }
        }

        return null;
    }

    async set<T>(key: string, data: T): Promise<void> {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now()
        };
        this.memoryCache.set(key, entry);
        await set(CACHE_PREFIX + key, entry);
    }

    invalidate(key: string) {
        this.memoryCache.delete(key);
    }

    clear() {
        this.memoryCache.clear();
    }
}

export const cacheManager = new CacheManager();
