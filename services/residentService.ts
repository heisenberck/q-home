
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Unit, Owner, Vehicle } from '../types';
import { logActivity } from './logService';

const CACHE_KEY = 'residents_cache_data';
const CACHE_TTL = 15 * 60 * 1000;

export const fetchResidents = async (forceRefresh = false) => {
    const now = Date.now();
    const cachedStr = sessionStorage.getItem(CACHE_KEY);

    if (cachedStr && !forceRefresh) {
        const cache = JSON.parse(cachedStr);
        if (now - cache.timestamp < CACHE_TTL) {
            return cache.data;
        }
    }

    try {
        const [unitsSnap, ownersSnap, vehiclesSnap] = await Promise.all([
            getDocs(collection(db, 'units')),
            getDocs(collection(db, 'owners')),
            getDocs(collection(db, 'vehicles'))
        ]);

        const units = unitsSnap.docs.map(d => d.data() as Unit);
        const owners = ownersSnap.docs.map(d => d.data() as Owner);
        const vehicles = vehiclesSnap.docs.map(d => d.data() as Vehicle);

        const freshData = { units, owners, vehicles };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: freshData }));

        return freshData;
    } catch (error) {
        console.error("Lỗi khi fetch residents:", error);
        throw error;
    }
};

/**
 * Thêm cư dân mới và ghi log tức thì
 */
export const addResident = async (unitData: Unit, ownerData: Owner) => {
    try {
        // Thực hiện ghi DB
        const unitRef = await addDoc(collection(db, 'units'), unitData);
        const ownerRef = await addDoc(collection(db, 'owners'), ownerData);

        // Ghi nhật ký (Optimistic)
        logActivity('CREATE', 'Cư dân', `Thêm mới cư dân ${ownerData.OwnerName} vào căn hộ ${unitData.UnitID}`);
        
        return { unitId: unitRef.id, ownerId: ownerRef.id };
    } catch (error) {
        console.error("Lỗi thêm cư dân:", error);
        throw error;
    }
};

/**
 * Xóa cư dân và ghi log
 */
export const deleteResident = async (unitId: string, ownerName: string) => {
    try {
        // Log trước khi xóa để giữ thông tin ngữ cảnh
        logActivity('DELETE', 'Cư dân', `Xóa hồ sơ cư dân ${ownerName} tại căn hộ ${unitId}`);
        
        await deleteDoc(doc(db, 'units', unitId));
        // Thêm logic xóa owner nếu cần...
        
        return true;
    } catch (error) {
        console.error("Lỗi xóa cư dân:", error);
        throw error;
    }
};
