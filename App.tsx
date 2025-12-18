
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
    UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, 
    Adjustment, ActivityLog, MonthlyStat, TariffCollection, InvoiceSettings, NewsItem, FeedbackItem, Role, PaymentStatus 
} from './types';
import { useSmartSystemData } from './hooks/useSmartData';
import FooterToast, { ToastMessage, ToastType } from './components/ui/Toast';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import OverviewPage from './components/pages/OverviewPage';
import BillingPage from './components/pages/BillingPage';
import ResidentsPage from './components/pages/ResidentsPage';
import VehiclesPage from './components/pages/VehiclesPage';
import WaterPage from './components/pages/WaterPage';
import PricingPage from './components/pages/PricingPage';
import UsersPage from './components/pages/UsersPage';
import SettingsPage from './components/pages/SettingsPage';
import BackupRestorePage from './components/pages/BackupRestorePage';
import ActivityLogPage from './components/pages/ActivityLogPage';
import NewsManagementPage from './components/pages/NewsManagementPage';
import FeedbackManagementPage from './components/pages/FeedbackManagementPage';
import LoginPage from './components/pages/LoginPage';
import ResidentLayout, { PortalPage } from './components/layout/ResidentLayout';
import PortalHomePage from './components/pages/portal/PortalHomePage';
import PortalNewsPage from './components/pages/portal/PortalNewsPage';
import PortalBillingPage from './components/pages/portal/PortalBillingPage';
import PortalContactPage from './components/pages/portal/PortalContactPage';
import PortalProfilePage from './components/pages/portal/PortalProfilePage';
import AdminMobileLayout, { AdminPortalPage } from './components/layout/AdminMobileLayout';
import AdminPortalHomePage from './components/pages/admin-portal/AdminPortalHomePage';
import AdminPortalResidentsPage from './components/pages/admin-portal/AdminPortalResidentsPage';
import AdminPortalVehiclesPage from './components/pages/admin-portal/AdminPortalVehiclesPage';
import AdminPortalBillingPage from './components/pages/admin-portal/AdminPortalBillingPage';
// Fix: Added missing import for NotificationListener to resolve errors on lines 326 and 356.
import NotificationListener from './components/common/NotificationListener';

import { 
    logActivity, updateResidentData, importResidentsBatch, 
    saveTariffs, saveAdjustments, saveWaterReadings, updateFeeSettings,
    deleteUsers as apiDeleteUsers, fetchLatestLogs
} from './services';

// --- Global Types ---
export type AdminPage = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement';

export interface LogPayload {
    module: ActivityLog['module'];
    action: string;
    summary: string;
    count?: number;
    ids?: string[];
    before_snapshot: any;
}

// --- Context Definitions ---
interface AuthContextType {
    user: UserPermission | null;
    login: (user: UserPermission, rememberMe: boolean) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission, oldEmail: string) => void;
    handleDeleteUsers: (usernames: string[]) => Promise<void>;
}

interface NotificationContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void;
}

interface SettingsContextType {
    invoiceSettings: InvoiceSettings;
    setInvoiceSettings: (settings: InvoiceSettings) => Promise<void>;
}

interface DataRefreshContextType {
    refreshData: (force?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const NotificationContext = createContext<NotificationContextType | null>(null);
const SettingsContext = createContext<SettingsContextType | null>(null);
const DataRefreshContext = createContext<DataRefreshContextType | null>(null);

// --- Exported Hooks ---
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within NotificationProvider');
    return context;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};

export const useDataRefresh = () => {
    const context = useContext(DataRefreshContext);
    if (!context) throw new Error('useDataRefresh must be used within DataRefreshProvider');
    return context;
};

export const useLogger = () => {
    const { user } = useAuth();
    const logAction = useCallback(async (payload: LogPayload) => {
        if (!user) return;
        const log: ActivityLog = {
            id: `log_${Date.now()}`,
            ts: new Date().toISOString(),
            actor_email: user.Email,
            actor_role: user.Role,
            module: payload.module,
            action: payload.action,
            summary: payload.summary,
            count: payload.count,
            ids: payload.ids,
            before_snapshot: payload.before_snapshot,
            undone: false,
            undo_token: null,
            undo_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        await logActivity(log);
    }, [user]);
    return { logAction };
};

// --- Fallback Constants ---
const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
    logoUrl: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    senderEmail: '',
    buildingName: 'HUD3 LINH ĐÀM',
    loginBackgroundUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920'
};

// --- Main Application Component ---
const App: React.FC = () => {
    // 1. Core State
    const [currentUser, setCurrentUser] = useState<UserPermission | null>(() => {
        const stored = localStorage.getItem('qhome_user');
        return stored ? JSON.parse(stored) : null;
    });

    // 2. Data Fetching Hook
    const { 
        units, owners, vehicles, tariffs, users, invoiceSettings: fetchedSettings, 
        adjustments, waterReadings, charges: fetchedCharges, monthlyStats, lockedWaterPeriods, 
        loading, refreshSystemData 
    } = useSmartSystemData(currentUser);

    // Hardened Settings Logic to prevent runtime TypeErrors (e.g. loginBackgroundUrl)
    const safeSettings = useMemo(() => fetchedSettings || DEFAULT_INVOICE_SETTINGS, [fetchedSettings]);

    // 3. UI State
    const [activePage, setActivePage] = useState<AdminPage | PortalPage | AdminPortalPage>('overview');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [charges, setChargesState] = useState<ChargeRaw[]>([]);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sync state with fetched data
    useEffect(() => {
        if (fetchedCharges) setChargesState(fetchedCharges);
    }, [fetchedCharges]);

    useEffect(() => {
        const loadLogs = async () => {
            if (currentUser && currentUser.Role !== 'Resident') {
                const logs = await fetchLatestLogs(20);
                setActivityLogs(logs);
            }
        };
        loadLogs();
    }, [currentUser]);

    // 4. Utility Handlers
    const showToast = useCallback((message: string, type: ToastType, duration = 3000) => {
        setToasts(prev => [...prev, { id: Date.now(), message, type, duration }]);
    }, []);

    const logAction = useCallback(async (payload: LogPayload) => {
        if (!currentUser) return;
        const log: ActivityLog = {
            id: `log_${Date.now()}`,
            ts: new Date().toISOString(),
            actor_email: currentUser.Email,
            actor_role: currentUser.Role,
            module: payload.module,
            action: payload.action,
            summary: payload.summary,
            count: payload.count,
            ids: payload.ids,
            before_snapshot: payload.before_snapshot,
            undone: false,
            undo_token: null,
            undo_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        await logActivity(log);
        setActivityLogs(prev => [log, ...prev].slice(0, 50));
    }, [currentUser]);

    const setCharges = useCallback((updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => {
        setChargesState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (logPayload) logAction(logPayload);
            return next;
        });
    }, [logAction]);

    const handleLogin = (u: UserPermission, rememberMe: boolean) => {
        setCurrentUser(u);
        localStorage.setItem('qhome_user', JSON.stringify(u));
        setActivePage(u.Role === 'Resident' ? 'portalHome' : 'overview');
        showToast(`Chào mừng trở lại, ${u.DisplayName || u.Username || 'User'}!`, 'success');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('qhome_user');
        setActivePage('overview');
    };

    const handleUpdateUser = (u: UserPermission) => {
        setCurrentUser(u);
        localStorage.setItem('qhome_user', JSON.stringify(u));
        showToast('Cập nhật tài khoản thành công.', 'success');
    };

    const handleDeleteUsers = async (usernames: string[]) => {
        const emails = users.filter(u => usernames.includes(u.Username || '')).map(u => u.Email);
        await apiDeleteUsers(emails);
        refreshSystemData(true);
    };

    const handleSaveResident = async (data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, reason: string) => {
        await updateResidentData(units, owners, vehicles, data);
        await logAction({ module: 'Residents', action: 'UPDATE', summary: `Cập nhật căn ${data.unit.UnitID}. Lý do: ${reason}`, before_snapshot: { unit: units.find(u => u.UnitID === data.unit.UnitID) } });
        refreshSystemData(true);
        showToast('Đã lưu thông tin cư dân.', 'success');
    };

    const handleImportData = async (updates: any[]) => {
        await importResidentsBatch(units, owners, vehicles, updates);
        refreshSystemData(true);
        showToast('Import dữ liệu thành công.', 'success');
    };

    const handleUpdateInvoiceSettings = async (s: InvoiceSettings) => {
        await updateFeeSettings(s);
        refreshSystemData(true);
        showToast('Đã lưu cấu hình hệ thống.', 'success');
    };

    const allData = useMemo(() => ({
        units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs, monthlyStats, lockedWaterPeriods
    }), [units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs, monthlyStats, lockedWaterPeriods]);

    // 5. Render Logic
    const renderAdminMobilePage = () => {
        const props = { units, vehicles, charges, monthlyStats, news, owners, activityLogs: [] };
        switch (activePage as AdminPortalPage) {
            case 'adminPortalHome': return <AdminPortalHomePage {...props} />;
            case 'adminPortalBilling': return <AdminPortalBillingPage charges={charges} units={units} owners={owners} />;
            case 'adminPortalResidents': return <AdminPortalResidentsPage units={units} owners={owners} vehicles={vehicles} />;
            case 'adminPortalVehicles': return <AdminPortalVehiclesPage vehicles={vehicles} units={units} owners={owners} />;
            case 'adminPortalMore': return (
                <div className="p-4 space-y-4">
                    <button onClick={() => setActivePage('newsManagement')} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center"><span className="font-bold">Quản lý Tin tức</span><span>→</span></button>
                    <button onClick={() => setActivePage('feedbackManagement')} className="w-full p-4 bg-white rounded-xl shadow-sm border flex justify-between items-center"><span className="font-bold">Phản hồi Cư dân</span><span>→</span></button>
                    <button onClick={() => handleLogout()} className="w-full p-4 bg-red-50 text-red-600 rounded-xl shadow-sm border flex justify-between items-center"><span className="font-bold">Đăng xuất</span><span>⏻</span></button>
                </div>
            );
            default: return <AdminPortalHomePage {...props} />;
        }
    };

    const renderDesktopContent = () => {
        switch (activePage as AdminPage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={(p) => setActivePage(p as any)} monthlyStats={monthlyStats} />;
            case 'billing': return <BillingPage charges={charges} setCharges={setCharges} allData={allData} onUpdateAdjustments={() => {}} role={currentUser!.Role} invoiceSettings={safeSettings} onRefresh={() => refreshSystemData(true)} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} activityLogs={activityLogs} onSaveResident={handleSaveResident} onImportData={handleImportData} onDeleteResidents={() => {}} role={currentUser!.Role} currentUser={currentUser!} onNavigate={(p) => setActivePage(p as any)} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} activityLogs={activityLogs} onSetVehicles={() => {}} role={currentUser!.Role} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={() => {}} allUnits={units} role={currentUser!.Role} tariffs={tariffs} lockedPeriods={lockedWaterPeriods} refreshData={refreshSystemData} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={() => {}} role={currentUser!.Role} />;
            case 'users': return <UsersPage users={users} setUsers={() => {}} units={units} role={currentUser!.Role} />;
            case 'settings': return <SettingsPage invoiceSettings={safeSettings} setInvoiceSettings={handleUpdateInvoiceSettings} role={currentUser!.Role} />;
            case 'backup': return <BackupRestorePage allData={allData} onRestore={() => refreshSystemData(true)} role={currentUser!.Role} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={() => {}} role={currentUser!.Role} />;
            case 'newsManagement': return <NewsManagementPage news={news} setNews={() => {}} role={currentUser!.Role} users={users} />;
            case 'feedbackManagement': return <FeedbackManagementPage feedback={feedback} setFeedback={() => {}} role={currentUser!.Role} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={(p) => setActivePage(p as any)} monthlyStats={monthlyStats} />;
        }
    };

    if (!currentUser) {
        return (
            <NotificationContext.Provider value={{ showToast }}>
                <SettingsContext.Provider value={{ invoiceSettings: safeSettings, setInvoiceSettings: handleUpdateInvoiceSettings }}>
                    <LoginPage users={users} onLogin={handleLogin} allOwners={owners} allUnits={units} />
                    <FooterToast toasts={toasts} onClose={(id) => setToasts(ts => ts.filter(t => t.id !== id))} onClearAll={() => setToasts([])} />
                </SettingsContext.Provider>
            </NotificationContext.Provider>
        );
    }

    if (currentUser.Role === 'Resident') {
        const owner = owners.find(o => o.OwnerID === currentUser.residentId) || null;
        return (
            <AuthContext.Provider value={{ user: currentUser, login: handleLogin, logout: handleLogout, updateUser: handleUpdateUser, handleDeleteUsers }}>
                <NotificationContext.Provider value={{ showToast }}>
                    <SettingsContext.Provider value={{ invoiceSettings: safeSettings, setInvoiceSettings: handleUpdateInvoiceSettings }}>
                        <DataRefreshContext.Provider value={{ refreshData: refreshSystemData }}>
                            <NotificationListener userId={currentUser.Username || currentUser.Email} />
                            <ResidentLayout 
                                activePage={activePage as PortalPage} 
                                setActivePage={(p) => setActivePage(p as any)} 
                                user={currentUser} 
                                owner={owner}
                                onUpdateOwner={() => {}} 
                                onChangePassword={() => {}}
                                notifications={{ unreadNews: 0, hasUnpaidBill: false, hasNewNotifications: false }}
                            >
                                {activePage === 'portalHome' && <PortalHomePage user={currentUser} owner={owner} charges={charges} news={news} setActivePage={(p) => setActivePage(p as any)} />}
                                {activePage === 'portalNews' && <PortalNewsPage news={news} />}
                                {activePage === 'portalBilling' && <PortalBillingPage charges={charges} user={currentUser} />}
                                {activePage === 'portalContact' && <PortalContactPage hotline={safeSettings?.senderName || 'Hotline BQL'} onSubmitFeedback={() => {}} />}
                                {activePage === 'portalProfile' && owner && <PortalProfilePage user={currentUser} owner={owner} onUpdateOwner={() => {}} onChangePassword={() => {}} />}
                            </ResidentLayout>
                            <FooterToast toasts={toasts} onClose={(id) => setToasts(ts => ts.filter(t => t.id !== id))} onClearAll={() => setToasts([])} />
                        </DataRefreshContext.Provider>
                    </SettingsContext.Provider>
                </NotificationContext.Provider>
            </AuthContext.Provider>
        );
    }

    // Admin View
    return (
        <AuthContext.Provider value={{ user: currentUser, login: handleLogin, logout: handleLogout, updateUser: handleUpdateUser, handleDeleteUsers }}>
            <NotificationContext.Provider value={{ showToast }}>
                <SettingsContext.Provider value={{ invoiceSettings: safeSettings, setInvoiceSettings: handleUpdateInvoiceSettings }}>
                    <DataRefreshContext.Provider value={{ refreshData: refreshSystemData }}>
                        <NotificationListener userId={currentUser.Username || currentUser.Email} />
                        {isMobile ? (
                            <AdminMobileLayout activePage={activePage as AdminPortalPage} setActivePage={(p) => setActivePage(p as any)} user={currentUser}>
                                {renderAdminMobilePage()}
                            </AdminMobileLayout>
                        ) : (
                            <div className="flex h-screen bg-slate-50 overflow-hidden">
                                <Sidebar activePage={activePage as AdminPage} setActivePage={(p) => setActivePage(p as any)} role={currentUser.Role} />
                                <div className="flex-1 flex flex-col min-w-0">
                                    <Header pageTitle="HUD3 Management" onNavigate={(p) => setActivePage(p as any)} />
                                    <main className="flex-1 overflow-y-auto p-6">
                                        {renderDesktopContent()}
                                    </main>
                                </div>
                            </div>
                        )}
                        <FooterToast toasts={toasts} onClose={(id) => setToasts(ts => ts.filter(t => t.id !== id))} onClearAll={() => setToasts([])} />
                    </DataRefreshContext.Provider>
                </SettingsContext.Provider>
            </NotificationContext.Provider>
        </AuthContext.Provider>
    );
};

export default App;
