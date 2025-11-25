import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { InvoiceSettings } from '../types';

/**
 * Fetches the invoice settings from Firestore.
 * @returns A promise that resolves to the InvoiceSettings object or null if not found.
 */
export const getFeeSettings = async (): Promise<InvoiceSettings | null> => {
    const settingsRef = doc(db, 'settings', 'invoice');
    const docSnap = await getDoc(settingsRef);
    if (docSnap.exists()) {
        return docSnap.data() as InvoiceSettings;
    }
    return null;
};

/**
 * Updates the invoice settings in Firestore.
 * @param settings The new settings object to save.
 * @returns A promise that resolves when the update is complete.
 */
export const updateFeeSettings = async (settings: InvoiceSettings): Promise<void> => {
    const settingsRef = doc(db, 'settings', 'invoice');
    await setDoc(settingsRef, settings, { merge: true });
};
