import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, UserPermission } from '../types';

export type DocumentName = 'units' | 'owners' | 'vehicles' | 'waterReadings' | 'charges' | 'tariffs' | 'users' | 'adjustments' | 'invoiceSettings' | 'activityLogs' | 'lockedPeriods';

interface AppData {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    waterReadings: WaterReading[];
    charges: ChargeRaw[];
    tariffs: {
        service: TariffService[];
        parking: TariffParking[];
        water: TariffWater[];
    };
    users: UserPermission[];
    adjustments: Adjustment[];
    invoiceSettings: InvoiceSettings;
    activityLogs: ActivityLog[];
    lockedPeriods?: string[];
}

const dataDocRef = doc(db, 'app_data', 'main_v1');

export const getAllData = async (): Promise<AppData | null> => {
    try {
        const docSnap = await getDoc(dataDocRef);
        if (docSnap.exists()) {
            return docSnap.data() as AppData;
        }
        console.log("No data document found in Firestore. Will initialize with mock data.");
        return null;
    } catch (error) {
        console.error("Error fetching data from Firestore:", error);
        throw error;
    }
};

export const saveData = async (key: DocumentName, data: any): Promise<void> => {
    try {
        await setDoc(dataDocRef, { [key]: data }, { merge: true });
    } catch (error) {
        console.error(`Error saving ${key} to Firestore:`, error);
        throw error;
    }
};

export const saveMultipleDocs = async (data: Partial<AppData>): Promise<void> => {
     try {
        await setDoc(dataDocRef, data, { merge: true });
    } catch (error) {
        console.error(`Error saving multiple docs to Firestore:`, error);
        throw error;
    }
}

export const saveAllData = async (data: Partial<AppData>): Promise<void> => {
    try {
        await setDoc(dataDocRef, data);
    } catch (error) {
        console.error("Error saving all data to Firestore:", error);
        throw error;
    }
};
