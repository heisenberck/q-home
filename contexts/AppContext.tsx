
import React, { createContext, useContext } from 'react';
import type { UserPermission, Role, InvoiceSettings, ToastType, LogPayload } from '../types';

export interface AppContextType {
    currentUser: UserPermission | null;
    role: Role | null;
    showToast: (message: string, type: ToastType, duration?: number) => void;
    logAction: (payload: LogPayload) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission) => void;
    invoiceSettings: InvoiceSettings;
    refreshData: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAuth must be used within an AppProvider');
    return { user: context.currentUser as UserPermission, role: context.role as Role, logout: context.logout, updateUser: context.updateUser };
};
export const useNotification = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useNotification must be used within an AppProvider');
    return { showToast: context.showToast };
};
export const useLogger = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useLogger must be used within an AppProvider');
    return { logAction: context.logAction };
};
export const useSettings = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useSettings must be used within an AppProvider');
    return { invoiceSettings: context.invoiceSettings };
};
export const useDataRefresh = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useDataRefresh must be used within an AppProvider');
    return { refreshData: context.refreshData };
};
