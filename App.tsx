
import React, { useState, useEffect, useCallback, createContext, useMemo, useRef } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, VehicleTier, TariffCollection, AllData, NewsItem, FeedbackItem, FeedbackReply, MonthlyStat } from './types';
import { patchKiosAreas, MOCK_NEWS_ITEMS, MOCK_FEEDBACK_ITEMS, MOCK_USER_PERMISSIONS } from './constants';
import { updateFeeSettings, updateResidentData, saveChargesBatch, saveVehicles, saveWaterReadings, saveTariffs, saveUsers, deleteUsers, saveAdjustments, importResidentsBatch, wipeAllBusinessData, resetUserPassword, logActivity } from './services';
import { requestForToken, onMessageListener, db } from './firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { useSmartSystemData } from './hooks/useSmartData';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ResidentLayout, { PortalPage } from './components/layout/ResidentLayout';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginPage from './components/pages/LoginPage';
import Spinner from './components/ui/Spinner';
import ChangePasswordModal from './components/pages/ChangePasswordModal';
import { isProduction } from './utils/env';
import NotificationListener from './components/common/NotificationListener';

// --- STATIC IMPORTS (NO LAZY LOADING) ---
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
import PortalHomePage from './components/pages/portal/PortalHomePage';
import PortalNewsPage from './components/pages/portal/PortalNewsPage';
import PortalBillingPage from './components/pages/portal/PortalBillingPage';
import PortalContactPage from './components/pages/portal/PortalContactPage';
import PortalProfilePage from './components/pages/portal/PortalProfilePage';

type AppData = {
    units: Unit[]; owners: Owner[]; vehicles: Vehicle[]; waterReadings: WaterReading[];
    charges: ChargeRaw[]; tariffs: TariffCollection; users: UserPermission[]; adjustments: Adjustment[];
    invoiceSettings: InvoiceSettings; activityLogs: ActivityLog[]; lockedPeriods?: string[];
};

const initialInvoiceSettings: InvoiceSettings = {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    accountName: 'Công ty cổ phần cung cấp Dịch vụ và Giải pháp', accountNumber: '020704070042387', bankName: 'HDBank - Chi nhánh Hoàn Kiếm',
    senderEmail: 'bqthud3linhdam@gmail.com', senderName: 'BQT HUD3 LINH DAM',
    emailSubject: '[BQL HUD3] THONG BAO PHI DICH VU KY {{period}} CHO CAN HO {{unit_id}}',
    emailBody: `Kinh gui Quy chu ho {{owner_name}},\n\nBan Quan ly (BQL) toa nha HUD3 Linh Dam tran trong thong bao phi dich vu ky {{period}} cua can ho {{unit_id}}.\n\nTong so tien can thanh toan la: {{total_due}}.\n\nVui long xem chi tiet phi dich vu ngay duoi day.\n\nTran trong,\nBQL Chung cu HUD3 Linh Dam.`,
    appsScriptUrl: '', transferContentTemplate: 'HUD3 {{unitId}} T{{period}}',
    footerHtml: `© {{YEAR}} BQL Chung cu HUD3 Linh Dam. Hotline: 0834.88.66.86`,
    footerShowInPdf: true, footerShowInEmail: true, footerShowInViewer: true,
    footerAlign: 'center', footerFontSize: 'sm',
    buildingName: 'HUD3 Linh Đàm', loginBackgroundUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1920',
};

export type AdminPage = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog' | 'newsManagement' | 'feedbackManagement';
type Page = AdminPage | PortalPage;

const pageTitles: Record<AdminPage, string> = {
    overview: 'Tổng quan', billing: 'Tính phí & Gửi phiếu', residents: 'Quản lý Cư dân',
    vehicles: 'Quản lý Phương tiện', water: 'Quản lý Nước', pricing: 'Quản lý Đơn giá',
    users: 'Quản lý Người dùng', settings: 'Cài đặt Phiếu báo & Thương hiệu', backup: 'Backup & Restore Dữ liệu',
    activityLog: 'Nhật ký Hoạt động', newsManagement: 'Quản lý Tin tức', feedbackManagement: 'Quản lý Phản hồi',
};

export type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until'>;

interface AppContextType {
    currentUser: UserPermission | null;
    role: Role | null;
    showToast: (message: string, type: ToastType, duration?: number) => void;
    logAction: (payload: LogPayload) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission, oldEmail?: string) => void;
    handleDeleteUsers: (emails: string[]) => void;
    invoiceSettings: InvoiceSettings;
    refreshData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAuth = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useAuth must be used within an AppProvider');
    return { user: context.currentUser as UserPermission, role: context.role as Role, logout: context.logout, updateUser: context.updateUser };
};
export const useNotification = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useNotification must be used within an AppProvider');
    return { showToast: context.showToast };
};
export const useLogger = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useLogger must be used within an AppProvider');
    return { logAction: context.logAction };
};
export const useSettings = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useSettings must be used within an AppProvider');
    return { invoiceSettings: context.invoiceSettings };
};
export const useDataRefresh = () => {
    const context = React.useContext(AppContext);
    if (!context) throw new Error('useDataRefresh must be used within an AppProvider');
    return { refreshData: context.refreshData };
}

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<UserPermission | null>(null);
    const [currentOwner, setCurrentOwner] = useState<Owner | null>(null);
    const [activePage, setActivePage] = useState<Page>('overview');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [resetInfo, setResetInfo] = useState<{ email: string; pass: string } | null>(null);
    
    // --- Smart Data Hook Integration ---
    const { 
        units, owners, vehicles, tariffs, users: smartUsers, 
        invoiceSettings: smartInvoiceSettings, adjustments, waterReadings, 
        activityLogs: loadedLogs, // Hook now returns activityLogs
        monthlyStats: loadedMonthlyStats, 
        lockedWaterPeriods, 
        loading: smartLoading, hasLoaded: smartHasLoaded, refreshSystemData 
    } = useSmartSystemData();

    // Local state
    const [charges, setCharges] = useState<ChargeRaw[]>([]);
    const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS_ITEMS);
    const [feedback, setFeedback] = useState<FeedbackItem[]>(MOCK_FEEDBACK_ITEMS);
    const [users, setUsers] = useState<UserPermission[]>([]);
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(initialInvoiceSettings);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]); // LOCAL State for Logs
    
    // Ref to track if logs have been synced initially
    const isFirstLogSync = useRef(true);

    const [notifications, setNotifications] = useState({
        unreadNews: 0,
        hasUnpaidBill: false,
        hasNewNotifications: false,
    });

    const IS_PROD = isProduction();

    // 3. Sync Smart Data to Local State
    useEffect(() => {
        if (smartHasLoaded) {
            setUsers(smartUsers.length > 0 ? smartUsers : MOCK_USER_PERMISSIONS); 
            if (smartInvoiceSettings) setInvoiceSettings(smartInvoiceSettings);
            if (loadedMonthlyStats) setMonthlyStats(loadedMonthlyStats);
            
            // Sync Activity Logs (Initial Load Only)
            if (loadedLogs && loadedLogs.length > 0 && isFirstLogSync.current) {
                setActivityLogs(loadedLogs);
                isFirstLogSync.current = false;
            }
            
            patchKiosAreas(units);
        }
    }, [smartHasLoaded, smartUsers, smartInvoiceSettings, units, loadedMonthlyStats, loadedLogs]);

    // 4. SMART CHARGES DATA STRATEGY ... (No change)
    const fetchChargesForMonth = useCallback(async (monthStr: string) => {
        if (!IS_PROD) return;
        try {
            const q = query(collection(db, 'charges'), where('Period', '==', monthStr));
            const snap = await getDocs(q);
            const freshCharges = snap.docs.map(d => d.data() as ChargeRaw);
            setCharges(prev => {
                const others = prev.filter(c => c.Period !== monthStr);
                return [...others, ...freshCharges];
            });
        } catch (e) {
            console.error("Error fetching charges for month:", monthStr, e);
        }
    }, [IS_PROD]);

    useEffect(() => {
        if (!currentUser) return;
        const loadInitialCharges = async () => {
            if (IS_PROD && charges.length === 0) {
                try {
                    const today = new Date();
                    today.setMonth(today.getMonth() - 2); 
                    const recent = today.toISOString().slice(0, 7);
                    const q = query(collection(db, 'charges'), where('Period', '>=', recent));
                    const snap = await getDocs(q);
                    const initialCharges = snap.docs.map(d => d.data() as ChargeRaw);
                    setCharges(initialCharges);
                } catch (e) {
                    console.error("Error loading initial charges", e);
                }
            }
        };
        loadInitialCharges();
        if (IS_PROD) {
            const q = query(collection(db, 'monthly_stats'), limit(12)); 
            const unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified' || change.type === 'added') {
                        const stat = change.doc.data() as MonthlyStat;
                        setMonthlyStats(prev => {
                            const others = prev.filter(s => s.period !== stat.period);
                            return [...others, stat].sort((a,b) => b.period.localeCompare(a.period));
                        });
                        fetchChargesForMonth(stat.period);
                    }
                });
            });
            return () => unsubscribe();
        }
    }, [currentUser, IS_PROD, fetchChargesForMonth]); 

    // --- Toast Logic ---
    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type, duration }]);
    }, []);
    const handleCloseToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);
    const handleClearAllToasts = useCallback(() => setToasts([]), []);

    // --- Notification & Messaging ---
    useEffect(() => {
        if (currentUser) {
            requestForToken();
            onMessageListener()
                .then((payload: any) => {
                    const title = payload?.notification?.title || 'Thông báo mới';
                    const body = payload?.notification?.body || '';
                    showToast(`${title}: ${body}`, 'info', 6000);
                })
                .catch((err) => console.log('failed: ', err));
        }
    }, [currentUser, showToast]);

    useEffect(() => {
        if (!currentUser) return;
        let hasUnpaidBill = false;
        if (currentUser.Role === 'Resident' && currentUser.residentId) {
            hasUnpaidBill = charges.some(c => 
                c.UnitID === currentUser.residentId && 
                ['pending', 'unpaid', 'reconciling'].includes(c.paymentStatus) &&
                c.TotalDue > c.TotalPaid
            );
        }
        const lastViewedNewsTime = parseInt(localStorage.getItem('lastViewedNews') || '0', 10);
        const lastViewedBellTime = parseInt(localStorage.getItem('lastViewedNotifications') || '0', 10);
        const unreadNewsCount = news.filter(n => new Date(n.date).getTime() > lastViewedNewsTime).length;
        const latestNewsTime = news.length > 0 ? Math.max(...news.map(n => new Date(n.date).getTime())) : 0;
        const hasNewNotifications = latestNewsTime > lastViewedBellTime || notifications.hasNewNotifications;
        setNotifications(prev => ({ unreadNews: unreadNewsCount, hasUnpaidBill, hasNewNotifications }));
    }, [currentUser, charges, news, notifications.hasNewNotifications]);

    useEffect(() => {
        if (currentUser?.Role === 'Resident' && smartHasLoaded) {
            const unit = units.find(u => u.UnitID === currentUser.residentId);
            if (unit) {
                const owner = owners.find(o => o.OwnerID === unit.OwnerID);
                setCurrentOwner(owner || null);
            }
        }
    }, [currentUser, units, owners, smartHasLoaded]);

    const handleInitialLogin = (user: UserPermission, rememberMe: boolean) => {
        if (rememberMe) localStorage.setItem('rememberedUser', user.Username || user.Email);
        else localStorage.removeItem('rememberedUser');
        setCurrentUser(user);
        setActivePage(user.Role === 'Resident' ? 'portalHome' : 'overview');
        if (user.mustChangePassword) setTimeout(() => setIsPasswordModalOpen(true), 500);
        showToast(`Chào mừng, ${user.Username || user.Email.split('@')[0]}!`, 'success');
    };
    
    const handlePasswordChanged = (newPassword: string) => {
        if (currentUser) {
            const updatedUser = { ...currentUser, password: newPassword, mustChangePassword: false };
            setCurrentUser(updatedUser);
            // Self-update password uses handleUpdateUser
            handleUpdateUser(updatedUser);
            setIsPasswordModalOpen(false);
            showToast('Mật khẩu đã được thay đổi thành công.', 'success');
        }
    };

    const handleLogout = useCallback(() => { 
        setCurrentUser(null); 
        setCurrentOwner(null);
        showToast('Đã đăng xuất.', 'info'); 
    }, [showToast]);

    const handleMarkNewsAsRead = useCallback(() => { 
        localStorage.setItem('lastViewedNews', Date.now().toString()); 
        setNotifications(prev => ({ ...prev, unreadNews: 0 })); 
    }, []);

    const handleMarkBellAsRead = useCallback(() => { 
        localStorage.setItem('lastViewedNotifications', Date.now().toString()); 
        setNotifications(prev => ({ ...prev, hasNewNotifications: false })); 
    }, []);
    
    // --- UPDATED: User Management with Delete Support ---
    
    const handleDeleteUsers = useCallback(async (emails: string[]) => {
        // Update Local State immediately
        setUsers(prev => prev.filter(u => !emails.includes(u.Email)));
        
        try {
            await deleteUsers(emails);
            logAction({ module: 'System', action: 'DELETE_USERS', summary: `Deleted ${emails.length} users`, ids: emails, before_snapshot: null });
            // showToast('Đã xóa người dùng thành công.', 'success'); // Toast handled in UsersPage usually
        } catch(e) {
            showToast('Lỗi xóa người dùng trên hệ thống.', 'error');
        }
    }, [showToast]);

    const handleUpdateUser = useCallback(async (updatedUser: UserPermission, oldEmail?: string) => {
        // Update Local State (Optimistic)
        setUsers(prev => {
            // Case 1: Email changed (renaming user ID)
            if (oldEmail && oldEmail !== updatedUser.Email) {
                // Remove old, add new (simulates renaming)
                return prev.map(u => u.Email === oldEmail ? updatedUser : u);
            }
            // Case 2: Standard update
            return prev.map(u => (u.Email === updatedUser.Email) ? updatedUser : u);
        });

        // Update Current User if applicable
        if (currentUser && (currentUser.Email === (oldEmail || updatedUser.Email))) {
            setCurrentUser(updatedUser);
        }

        // Persist to DB
        try {
            await saveUsers([updatedUser]);
            
            // If email changed, delete the old document
            if (oldEmail && oldEmail !== updatedUser.Email) {
                await deleteUsers([oldEmail]);
            }
            
            showToast('Cập nhật hồ sơ thành công.', 'success');
        } catch(e) {
            showToast('Lỗi lưu thay đổi vào hệ thống.', 'error');
        }
    }, [currentUser, showToast]);

    // --- ACTIVITY LOG LOGIC ---
    const logAction = useCallback(async (payload: LogPayload) => {
        if (!currentUser) return;
        
        const newLog: ActivityLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ts: new Date().toISOString(),
            actor_email: currentUser.Email,
            actor_role: currentUser.Role,
            undone: false,
            undo_token: null,
            undo_until: null,
            ...payload
        };

        setActivityLogs(prev => [newLog, ...prev]);

        try {
            await logActivity(newLog);
        } catch (err) {
            console.error("Failed to save log", err);
        }
    }, [currentUser]);

    const createDataHandler = <T,>(stateSetter: React.Dispatch<React.SetStateAction<T>>, saveFunction: (data: T) => Promise<any>) => useCallback(async (updater: React.SetStateAction<T>, logPayload?: LogPayload) => {
        stateSetter(prevState => {
            const newState = typeof updater === 'function' ? (updater as (prevState: T) => T)(prevState) : updater;
            saveFunction(newState).then(() => { 
                if (logPayload) logAction(logPayload);
                showToast('Dữ liệu đã được lưu.', 'success'); 
            }).catch(error => { showToast('Lưu dữ liệu thất bại.', 'error'); stateSetter(prevState); });
            return newState;
        });
    }, [logAction, showToast]);

    const handleSetUsers = createDataHandler(setUsers, saveUsers);
    
    // Wrapped handler for Charges
    const handleSetCharges = useCallback(async (updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => {
        let newCharges: ChargeRaw[];
        if (typeof updater === 'function') {
            newCharges = (updater as (prevState: ChargeRaw[]) => ChargeRaw[])(charges);
        } else {
            newCharges = updater;
        }
        try {
            const period = newCharges[0]?.Period;
            let periodStat: MonthlyStat | undefined;
            if (period) {
                const chargesForPeriod = newCharges.filter(c => c.Period === period);
                periodStat = {
                    period: period,
                    totalService: chargesForPeriod.reduce((sum, c) => sum + c.ServiceFee_Total, 0),
                    totalParking: chargesForPeriod.reduce((sum, c) => sum + c.ParkingFee_Total, 0),
                    totalWater: chargesForPeriod.reduce((sum, c) => sum + c.WaterFee_Total, 0),
                    totalDue: chargesForPeriod.reduce((sum, c) => sum + c.TotalDue, 0),
                    updatedAt: new Date().toISOString()
                };
            }
            await saveChargesBatch(newCharges, periodStat);
            setCharges(newCharges);
            if (periodStat) {
                setMonthlyStats(prev => {
                    const others = prev.filter(s => s.period !== period);
                    return [...others, periodStat!];
                });
            }
            if (logPayload) logAction(logPayload);
            showToast('Dữ liệu đã được lưu.', 'success');
        } catch (error) {
            console.error(error);
            showToast('Lưu dữ liệu thất bại.', 'error');
        }
    }, [charges, logAction, showToast]);

    const handleSetVehicles = useCallback(async (updater: React.SetStateAction<Vehicle[]>, logPayload?: LogPayload) => {
        let newVehicles: Vehicle[];
        if (typeof updater === 'function') {
            newVehicles = (updater as (prevState: Vehicle[]) => Vehicle[])(vehicles);
        } else {
            newVehicles = updater;
        }
        try {
            await saveVehicles(newVehicles);
            if (logPayload) logAction(logPayload);
            showToast('Dữ liệu đã được lưu.', 'success');
            refreshSystemData(true);
        } catch (error) {
            console.error(error);
            showToast('Lưu dữ liệu thất bại.', 'error');
        }
    }, [vehicles, logAction, showToast, refreshSystemData]);

    const handleSetWaterReadings = createDataHandler(() => {}, saveWaterReadings);
    const handleSetTariffs = createDataHandler(() => {}, saveTariffs);
    const handleSetAdjustments = createDataHandler(() => {}, saveAdjustments);
    const handleSetNews = createDataHandler(setNews, async (d) => {});
    const handleSetFeedback = createDataHandler(setFeedback, async (d) => {});

    const handleSubmitFeedback = (item: FeedbackItem) => {
        handleSetFeedback(prev => [item, ...prev], { module: 'Feedback', action: 'CREATE', summary: `Cư dân ${item.residentId} gửi phản hồi.`, before_snapshot: feedback });
    };

    const handleUpdateOwner = (updatedOwner: Owner) => {
        setCurrentOwner(updatedOwner);
        showToast('Cập nhật hồ sơ thành công (UI Only).', 'success');
    };

    const handleSaveResident = useCallback(async (updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, reason: string) => {
        try {
            await updateResidentData(units, owners, vehicles, updatedData);
            if (currentUser) {
                logAction({
                    module: 'Residents',
                    action: 'UPDATE_RESIDENT',
                    summary: `Cập nhật căn ${updatedData.unit.UnitID}: ${reason}`,
                    ids: [updatedData.unit.UnitID],
                    before_snapshot: null
                });
            }
            refreshSystemData(true); 
            showToast('Cập nhật thông tin cư dân thành công!', 'success');
        } catch (e: any) {
            showToast(`Lỗi khi cập nhật: ${e.message}`, 'error');
        }
    }, [units, owners, vehicles, showToast, refreshSystemData, logAction, currentUser]);

    const handleRestoreAllData = useCallback(async (data: AppData) => { /* ... */ }, [showToast]);

    const handleImportResidents = async (updates: any[]) => {
        try {
            const result = await importResidentsBatch(units, owners, vehicles, updates);
            if (currentUser) {
                logAction({
                    module: 'Residents',
                    action: 'IMPORT_BATCH',
                    summary: `Import ${updates.length} dòng dữ liệu cư dân`,
                    count: updates.length,
                    before_snapshot: null
                });
            }
            refreshSystemData(true);
            showToast('Nhập dữ liệu thành công!', 'success');
        } catch (e: any) {
            showToast(`Lỗi khi nhập dữ liệu: ${e.message}`, 'error');
        }
    }

    const renderAdminPage = () => {
        const allDataForBilling: AllData = { units, owners, vehicles, waterReadings, tariffs, adjustments, activityLogs, monthlyStats, lockedWaterPeriods };
        switch (activePage as AdminPage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={setActivePage as (p: AdminPage) => void} monthlyStats={monthlyStats} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges} allData={allDataForBilling} onUpdateAdjustments={handleSetAdjustments} role={currentUser!.Role} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} activityLogs={activityLogs} onSaveResident={handleSaveResident} onImportData={handleImportResidents} onDeleteResidents={()=>{}} role={currentUser!.Role} currentUser={currentUser!} onNavigate={setActivePage as (page: string) => void} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} activityLogs={activityLogs} onSetVehicles={handleSetVehicles} role={currentUser!.Role} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={handleSetWaterReadings} allUnits={units} role={currentUser!.Role} tariffs={tariffs} lockedPeriods={lockedWaterPeriods} refreshData={refreshSystemData} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs} role={currentUser!.Role} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers} units={units} role={currentUser!.Role} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={updateFeeSettings} role={currentUser!.Role} />;
            case 'backup': return <BackupRestorePage allData={{ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings }} onRestore={handleRestoreAllData} role={currentUser!.Role} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={() => {}} role={currentUser!.Role} />;
            case 'newsManagement': return <NewsManagementPage news={news} setNews={handleSetNews} role={currentUser!.Role} users={users} />;
            case 'feedbackManagement': return <FeedbackManagementPage feedback={feedback} setFeedback={handleSetFeedback} role={currentUser!.Role} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} activityLogs={activityLogs} feedback={feedback} onNavigate={setActivePage as (p: AdminPage) => void} monthlyStats={monthlyStats} />;
        }
    };
    
    const renderPortalPage = () => {
        switch (activePage as PortalPage) {
            case 'portalHome': return <PortalHomePage user={currentUser!} owner={currentOwner} charges={charges} setActivePage={setActivePage as (p: PortalPage) => void} news={news} />;
            case 'portalNews': return <PortalNewsPage news={news} />;
            case 'portalBilling': return <PortalBillingPage charges={charges} user={currentUser!} />;
            case 'portalContact': return <PortalContactPage hotline={invoiceSettings.footerHtml?.match(/(\d{8,})/)?.[0] || '0900000000'} onSubmitFeedback={handleSubmitFeedback} />;
            case 'portalProfile': return <PortalProfilePage user={currentUser!} owner={currentOwner!} onUpdateOwner={handleUpdateOwner} onChangePassword={() => setIsPasswordModalOpen(true)} />;
            default: return <PortalHomePage user={currentUser!} owner={currentOwner} charges={charges} setActivePage={setActivePage as (p: PortalPage) => void} news={news} />;
        }
    };

    const contextValue = useMemo(() => ({ 
        currentUser, role: currentUser?.Role || null, 
        showToast, logAction, logout: handleLogout, 
        updateUser: handleUpdateUser, handleDeleteUsers, // Export handle Delete
        invoiceSettings,
        refreshData: () => refreshSystemData(true)
    }), [currentUser, showToast, logAction, handleLogout, handleUpdateUser, handleDeleteUsers, invoiceSettings, refreshSystemData]);
    
    if (!smartHasLoaded && !currentUser) {
        return <div className="flex h-screen w-screen items-center justify-center"><Spinner /></div>;
    }

    if (!currentUser) {
        return <AppContext.Provider value={contextValue}><LoginPage users={users} onLogin={handleInitialLogin} allOwners={owners} allUnits={units} resetInfo={resetInfo} /><FooterToast toasts={toasts} onClose={handleCloseToast} onClearAll={handleClearAllToasts} /></AppContext.Provider>;
    }
    
    return (
        <AppContext.Provider value={contextValue}>
            {isPasswordModalOpen && <ChangePasswordModal onClose={() => setIsPasswordModalOpen(false)} onSave={handlePasswordChanged} />}
            {currentUser && <NotificationListener userId={currentUser.Username || currentUser.residentId || ''} />}
            {currentUser.Role === 'Resident' ? (
                <ResidentLayout 
                    activePage={activePage as PortalPage} 
                    setActivePage={setActivePage as (p: PortalPage) => void}
                    user={currentUser}
                    owner={currentOwner}
                    onUpdateOwner={handleUpdateOwner}
                    onChangePassword={() => setIsPasswordModalOpen(true)}
                    notifications={notifications}
                    onMarkNewsAsRead={handleMarkNewsAsRead}
                    onMarkBellAsRead={handleMarkBellAsRead}
                >
                    {renderPortalPage()}
                </ResidentLayout>
            ) : (
                <div className="flex h-screen text-gray-900">
                    <Sidebar activePage={activePage as AdminPage} setActivePage={setActivePage} role={currentUser.Role}/>
                    <div className="flex flex-col flex-1 w-full overflow-hidden">
                        <Header pageTitle={pageTitles[activePage as AdminPage]} onNavigate={setActivePage as (page: AdminPage) => void} />
                        <main className="flex-1 p-6 overflow-y-auto">
                            {renderAdminPage()}
                        </main>
                    </div>
                </div>
            )}
            <FooterToast toasts={toasts} onClose={handleCloseToast} onClearAll={handleClearAllToasts} />
        </AppContext.Provider>
    );
};

export default App;
