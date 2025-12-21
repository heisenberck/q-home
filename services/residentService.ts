
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Unit, Owner, Vehicle } from '../types';

const CACHE_KEY = 'residents_cache_data';
const CACHE_TTL = 15 * 60 * 1000; // 15 phút (ms)

/**
 * Lấy dữ liệu cư dân có tích hợp cache.
 * @param forceRefresh Nếu true, bỏ qua cache và fetch mới từ Firestore
 */
export const fetchResidents = async (forceRefresh = false) => {
    const now = Date.now();
    const cachedStr = sessionStorage.getItem(CACHE_KEY);

    if (cachedStr && !forceRefresh) {
        const cache = JSON.parse(cachedStr);
        if (now - cache.timestamp < CACHE_TTL) {
            console.log("[Service] Trả về dữ liệu cư dân từ cache.");
            return cache.data;
        }
    }

    console.log("[Service] Đang tải dữ liệu mới từ Firestore...");
    try {
        // Fetch đồng thời các collection để tối ưu tốc độ
        const [unitsSnap, ownersSnap, vehiclesSnap] = await Promise.all([
            getDocs(collection(db, 'units')),
            getDocs(collection(db, 'owners')),
            getDocs(collection(db, 'vehicles'))
        ]);

        const units = unitsSnap.docs.map(d => d.data() as Unit);
        const owners = ownersSnap.docs.map(d => d.data() as Owner);
        const vehicles = vehiclesSnap.docs.map(d => d.data() as Vehicle);

        const freshData = { units, owners, vehicles };

        // Lưu vào cache
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: now,
            data: freshData
        }));

        return freshData;
    } catch (error) {
        console.error("Lỗi khi fetch residents:", error);
        throw error;
    }
};
