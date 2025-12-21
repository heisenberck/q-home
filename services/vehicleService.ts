import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Vehicle } from '../types';

const CACHE_KEY = 'vehicles_cache_v1';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface CachedVehicles {
  data: Vehicle[];
  timestamp: number;
}

/**
 * Fetches all vehicles with session-level caching.
 */
export const fetchAllVehicles = async (forceRefresh = false): Promise<Vehicle[]> => {
  if (!forceRefresh) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedVehicles = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          console.log('[VehicleService] Serving from session cache');
          return parsed.data;
        }
      } catch (e) {
        sessionStorage.removeItem(CACHE_KEY);
      }
    }
  }

  console.log('[VehicleService] Fetching fresh data from Firestore');
  const snap = await getDocs(collection(db, 'vehicles'));
  const vehicles = snap.docs.map(d => d.data() as Vehicle);

  const cachePayload: CachedVehicles = {
    data: vehicles,
    timestamp: Date.now()
  };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));

  return vehicles;
};
