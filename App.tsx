
import React, { useState, useEffect, useCallback, createContext, useContext, useMemo, lazy, Suspense } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog, VehicleTier } from './types';
import { 
    MOCK_USER_PERMISSIONS, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, 
    patchKiosAreas, MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_ADJUSTMENTS 
} from './constants';
import { UnitType } from './types';

import { db } from './firebaseConfig';
import { getDocs, collection, getDoc, doc, writeBatch } from "firebase/firestore";


import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginModal from './components/ui/LoginModal';
import LoginPage from './components/pages/LoginPage';
import Spinner from './components/ui/Spinner';
import { processFooterHtml } from './utils/helpers';
import { WarningIcon } from './components/ui/Icons';

// Lazy load page components
const OverviewPage = lazy(() => import('./components/pages/OverviewPage'));
const BillingPage = lazy(() => import('./components/pages/BillingPage'));
const ResidentsPage = lazy(() => import('./components/pages/ResidentsPage'));
const VehiclesPage = lazy(() => import('./components/pages/VehiclesPage'));
const WaterPage = lazy(() => import('./components/pages/WaterPage'));
const PricingPage = lazy(() => import('./components/pages/PricingPage'));
const UsersPage = lazy(() => import('./components/pages/UsersPage'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));
const BackupRestorePage = lazy(() => import('./components/pages/BackupRestorePage'));
const ActivityLogPage = lazy(() => import('./components/pages/ActivityLogPage'));

type AppData = {
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
};


const saspLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const initialInvoiceSettings: InvoiceSettings = {
    logoUrl: saspLogoBase64,
    accountName: 'Công ty cổ phần cung cấp Dịch vụ và Giải pháp',
    accountNumber: '020704070042387',
    bankName: 'HDBank - Chi nhánh Hoàn Kiếm',
    senderEmail: 'bqthud3linhdam@gmail.com',
    senderName: 'BQT HUD3 Linh Đàm',
    emailSubject: '[BQL HUD3] Thông báo phí dịch vụ kỳ {{period}} cho căn hộ {{unit_id}}',
    emailBody: `Kính gửi Quý chủ hộ {{owner_name}},

Ban Quản lý (BQL) tòa nhà HUD3 Linh Đàm trân trọng thông báo phí dịch vụ kỳ {{period}} của căn hộ {{unit_id}}.

Tổng số tiền cần thanh toán là: {{total_due}}.

Vui lòng xem chi tiết phí dịch vụ ngay dưới đây.

Trân trọng,
BQL Chung cư HUD3 Linh Đàm.`,
    appsScriptUrl: '',
    footerHtml: `© {{YEAR}} BQL Chung cư HUD3 Linh Đàm. Hotline: 0834.88.66.86`,
    footerShowInPdf: true,
    footerShowInEmail: true,
    footerShowInViewer: true,
    footerAlign: 'center',
    footerFontSize: 'sm',
};


type Page = 'overview' | 'billing' | 'residents' | 'vehicles' | 'water' | 'pricing' | 'users' | 'settings' | 'backup' | 'activityLog';
const pageTitles: Record<Page, string> = {
    overview: 'Tổng quan',
    billing: 'Tính phí & Gửi phiếu',
    residents: 'Quản lý Cư dân',
    vehicles: 'Quản lý Phương tiện',
    water: 'Quản lý Nước',
    pricing: 'Quản lý Đơn giá',
    users: 'Quản lý Người dùng',
    settings: 'Cài đặt Phiếu báo',
    backup: 'Backup & Restore Dữ liệu',
    activityLog: 'Nhật ký Hoạt động',
};

// --- START: CONTEXT AND HOOKS ---
type LogPayload = Omit<ActivityLog, 'id' | 'ts' | 'actor_email' | 'actor_role' | 'undone' | 'undo_token' | 'undo_until'>;

interface AppContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    currentUser: UserPermission | null;
    role: Role | null;
    setCurrentUser: (user: UserPermission) => void;
    showToast: (message: string, type: ToastType, duration?: number) => void;
    switchUserRequest: (user: UserPermission) => void;
    logAction: (payload: LogPayload) => void;
    logout: () => void;
    updateUser: (updatedUser: UserPermission) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useTheme = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useTheme must be used within an AppProvider');
    return { theme: context.theme, toggleTheme: context.toggleTheme };
};

export const useAuth = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAuth must be used within an AppProvider');
    return { 
        user: context.currentUser as UserPermission, 
        role: context.role as Role, 
        setCurrentUser: context.setCurrentUser, 
        switchUserRequest: context.switchUserRequest,
        logout: context.logout,
        updateUser: context.updateUser
    };
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
// --- END: CONTEXT AND HOOKS ---


const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    // Default to 'loaded' so the Login screen shows up immediately without waiting for data
    const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loaded');
    const [errorMessage, setErrorMessage] = useState('');
    const [activePage, setActivePage] = useState<Page>('overview');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    // Data State (Centralized)
    const [units, setUnits] = useState<Unit[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
    const [charges, setCharges] = useState<ChargeRaw[]>([]);
    const [tariffs, setTariffs] = useState<any>({ service: [], parking: [], water: [] });
    // Initialize users with Mock data so login works immediately
    const [users, setUsers] = useState<UserPermission[]>(MOCK_USER_PERMISSIONS);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(initialInvoiceSettings);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    // --- RBAC & AUTH (Session only, no persistence) ---
    const [currentUser, setCurrentUser] = useState<UserPermission | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const newToast: ToastMessage = { id: Date.now() + Math.random(), message, type, duration };
        setToasts(prevToasts => [...prevToasts, newToast]);
    }, []);

    const handleCloseToast = useCallback(() => {
        setToasts(prevToasts => prevToasts.slice(1));
    }, []);

    const loadMockData = useCallback(() => {
        console.warn("[Q-Home] Đang dùng dữ liệu giả lập (do lỗi kết nối hoặc DB trống).");
        showToast("Đang dùng dữ liệu giả lập.", 'warn');

        const patchedUnits = [...MOCK_UNITS];
        patchKiosAreas(patchedUnits);

        setUnits(patchedUnits);
        setOwners(MOCK_OWNERS);
        setVehicles(MOCK_VEHICLES);
        setWaterReadings(MOCK_WATER_READINGS);
        setCharges([]);
        setAdjustments(MOCK_ADJUSTMENTS);
        setActivityLogs([]);
        // Preserve users if they have been loaded/modified
        setUsers(prev => prev.length > 0 ? prev : MOCK_USER_PERMISSIONS);
        setTariffs({ service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER });
        setInvoiceSettings(initialInvoiceSettings);
    }, [showToast]);
    
    const setEmptyData = () => {
        setUnits([]);
        setOwners([]);
        setVehicles([]);
        setWaterReadings([]);
        setCharges([]);
        setAdjustments([]);
        setActivityLogs([]);
        // Keep users for login/management
        setUsers(prev => prev.length > 0 ? prev : MOCK_USER_PERMISSIONS);
        setTariffs({ service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER });
        setInvoiceSettings(initialInvoiceSettings);
    };

    // --- DATA FETCHING STRATEGY (DEV vs PROD) ---
    useEffect(() => {
        // 🛡️ PROTECT DATA FLOW: Only fetch if user is logged in
        if (!currentUser) {
            return;
        }

        const loadData = async (retryCount = 0) => {
            setLoadingState('loading');
            const isProduction = process.env.NODE_ENV === 'production';

            try {
                const collectionsToFetch = ['units', 'owners', 'vehicles', 'waterReadings', 'charges', 'adjustments', 'users', 'activityLogs'];
                const promises = collectionsToFetch.map(c => getDocs(collection(db, c)));
                
                const snapshots = await Promise.all(promises);
                const [unitsSnap, ownersSnap, vehiclesSnap, waterReadingsSnap, chargesSnap, adjustmentsSnap, usersSnap, activityLogsSnap] = snapshots;
                
                const hasData = unitsSnap.docs.length > 0;

                const settingsPromises = [
                    getDoc(doc(db, 'settings', 'invoice')),
                    getDoc(doc(db, 'settings', 'tariffs'))
                ];
                const [invoiceSettingsSnap, tariffsSnap] = await Promise.all(settingsPromises);
                
                const loadedInvoiceSettings = invoiceSettingsSnap.exists() ? invoiceSettingsSnap.data() as InvoiceSettings : initialInvoiceSettings;
                const loadedTariffs = tariffsSnap.exists() ? tariffsSnap.data() : { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER };

                setInvoiceSettings(loadedInvoiceSettings);
                setTariffs(loadedTariffs);

                if (isProduction) {
                    if (hasData) {
                        console.log("[Production] Đã tải dữ liệu thành công từ Firestore.");
                        const loadedUnits = unitsSnap.docs.map(d => d.data() as Unit);
                        patchKiosAreas(loadedUnits);
                        setUnits(loadedUnits);
                        setOwners(ownersSnap.docs.map(d => d.data() as Owner));
                        setVehicles(vehiclesSnap.docs.map(d => d.data() as Vehicle));
                        setWaterReadings(waterReadingsSnap.docs.map(d => d.data() as WaterReading));
                        setCharges(chargesSnap.docs.map(d => d.data() as ChargeRaw));
                        setAdjustments(adjustmentsSnap.docs.map(d => d.data() as Adjustment));
                        const loadedUsers = usersSnap.docs.map(d => d.data() as UserPermission);
                        // If DB users exist, use them. Otherwise fallback to mock/initial to prevent lockout
                        if (loadedUsers.length > 0) setUsers(loadedUsers);
                        setActivityLogs(activityLogsSnap.docs.map(d => d.data() as ActivityLog).sort((a,b) => b.ts.localeCompare(a.ts)));
                    } else {
                        console.warn("[Production] Found 0 documents. Hiển thị trạng thái rỗng.");
                        setEmptyData();
                    }
                    setLoadingState('loaded');
                } else { // Development Mode
                    if (hasData) {
                        console.log("[Development] Đang dùng dữ liệu thật từ Firestore.");
                        const loadedUnits = unitsSnap.docs.map(d => d.data() as Unit);
                        patchKiosAreas(loadedUnits);
                        setUnits(loadedUnits);
                        setOwners(ownersSnap.docs.map(d => d.data() as Owner));
                        setVehicles(vehiclesSnap.docs.map(d => d.data() as Vehicle));
                        setWaterReadings(waterReadingsSnap.docs.map(d => d.data() as WaterReading));
                        setCharges(chargesSnap.docs.map(d => d.data() as ChargeRaw));
                        setAdjustments(adjustmentsSnap.docs.map(d => d.data() as Adjustment));
                        const loadedUsers = usersSnap.docs.map(d => d.data() as UserPermission);
                        if (loadedUsers.length > 0) setUsers(loadedUsers);
                        setActivityLogs(activityLogsSnap.docs.map(d => d.data() as ActivityLog).sort((a,b) => b.ts.localeCompare(a.ts)));
                    } else {
                        loadMockData();
                    }
                    setLoadingState('loaded');
                }
            } catch (error: any) {
                // 🛡️ RETRY LOGIC: If offline, retry once after 1 second
                const isOffline = error.message?.includes('offline') || error.code === 'unavailable' || error.message?.includes('client is offline');
                
                if (isOffline && retryCount < 1) {
                    console.warn("Connection failed (offline), retrying in 1s...");
                    setTimeout(() => loadData(retryCount + 1), 1000);
                    return;
                }

                if (isProduction) {
                    console.error("[Production] Connection Error.", error);
                    setErrorMessage("Mất kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử tải lại trang.");
                    setLoadingState('error');
                } else { // Development fallback
                    console.warn("[Development] Connection Error. Falling back to mock data.", error);
                    loadMockData();
                    setLoadingState('loaded');
                }
            }
        };
        loadData();
    }, [loadMockData, currentUser]); // Add currentUser to dependency array

    useEffect(() => {
        // Validate current user on startup against user list
        if (currentUser && users.length > 0) {
            const validUser = users.find(u => u.Email === currentUser.Email);
            if (!validUser || validUser.status !== 'Active') {
                handleLogout();
            }
        }
    }, [currentUser, users]);
    
    const role: Role | null = currentUser?.Role || null;
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [userToSwitchTo, setUserToSwitchTo] = useState<UserPermission | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const MASTER_PASSWORD = '123456a@A';

    const handleSwitchUserRequest = (user: UserPermission) => {
        setUserToSwitchTo(user);
        setLoginError(null);
        setIsLoginModalOpen(true);
    };

    const handleLoginAttempt = (password: string) => {
        const validUser = users.find(u => u.Email === userToSwitchTo?.Email);
        if (!validUser) { setLoginError('Người dùng không tồn tại.'); return; }
        if (validUser.status !== 'Active') { setLoginError('Tài khoản này đã bị vô hiệu hóa.'); return; }

        const isMasterOverride = validUser.Role === 'Admin' && password === MASTER_PASSWORD;
        if (validUser.password === password || isMasterOverride) {
            setCurrentUser(validUser);
            setIsLoginModalOpen(false);
            setUserToSwitchTo(null);
            setLoginError(null);
            showToast(`Đã chuyển sang người dùng ${validUser.Email}`, 'success');
        } else {
            setLoginError('Mật khẩu không đúng. Vui lòng thử lại.');
        }
    };

    const handleInitialLogin = (user: UserPermission) => {
        setCurrentUser(user);
        showToast(`Chào mừng quay trở lại, ${user.Username || user.Email.split('@')[0]}!`, 'success');
    };

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        showToast('Đã đăng xuất.', 'info');
    }, [showToast]);

    const handleUpdateUser = useCallback((updatedUser: UserPermission) => {
        setUsers(prev => prev.map(u => (currentUser && u.Email === currentUser.Email) ? updatedUser : u));
        if (currentUser && (currentUser.Email === updatedUser.Email)) {
             setCurrentUser(updatedUser);
        }
    }, [currentUser]);


    // --- THEME EFFECT ---
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

    // --- ACTIVITY LOGGING (In-memory only) ---
    const logAction = useCallback((payload: LogPayload) => {
        if (!currentUser) return;
        const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newLog: ActivityLog = { id: logId, ts: new Date().toISOString(), actor_email: currentUser.Email, actor_role: currentUser.Role, undone: false, undo_token: null, undo_until: null, ...payload };
        
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
    }, [currentUser]);

    const handleUndoAction = useCallback((logId: string) => {
        showToast('Chức năng hoàn tác không được hỗ trợ ở chế độ dữ liệu tạm thời.', 'warn');
    }, [showToast]);

    // --- DATA HANDLERS (In-memory only) ---
    const createDataHandler = <T,>(
        stateSetter: React.Dispatch<React.SetStateAction<T>>
    ) => useCallback((updater: React.SetStateAction<T>, logPayload?: LogPayload) => {
        stateSetter(updater);
        if (logPayload) {
            logAction(logPayload);
        }
    }, [logAction]);
    
    const handleSetCharges = createDataHandler(setCharges);
    const handleSetAdjustments = useCallback((updater: React.SetStateAction<Adjustment[]>, details: string) => {
        setAdjustments(prev => {
            logAction({ module: 'Billing', action: 'UPDATE_ADJUSTMENTS', summary: details, before_snapshot: prev });
            if (typeof updater === 'function') {
                return (updater as (prevState: Adjustment[]) => Adjustment[])(prev);
            }
            return updater;
        });
    }, [logAction]);
    const handleSetTariffs = createDataHandler(setTariffs);
    const handleSetWaterReadings = useCallback((updater: React.SetStateAction<WaterReading[]>, summary?: string) => {
        setWaterReadings(prev => {
            if (summary) {
                logAction({ module: 'Water', action: 'BULK_UPDATE_WATER_READINGS', summary: summary, before_snapshot: prev });
            }
            if (typeof updater === 'function') {
                return (updater as (prevState: WaterReading[]) => WaterReading[])(prev);
            }
            return updater;
        });
    }, [logAction]);
    const handleSetUsers = createDataHandler(setUsers);
    const handleSetInvoiceSettings = createDataHandler(setInvoiceSettings);
    const handleSetVehicles = createDataHandler(setVehicles);
    
    const handleSaveResident = useCallback((updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }) => {
        const { unit, owner, vehicles: draftVehicles } = updatedData;
        
        setUnits(prev => prev.map(u => u.UnitID === unit.UnitID ? unit : u));
        setOwners(prev => prev.map(o => o.OwnerID === owner.OwnerID ? owner : o));
        
        setVehicles(prevVehicles => {
            const otherVehicles = prevVehicles.filter(v => v.UnitID !== unit.UnitID);
            const processedVehicles = draftVehicles.map(v => ({...v, VehicleId: v.VehicleId.startsWith('VEH_NEW_') ? `VEH${Math.floor(1000 + Math.random() * 9000)}` : v.VehicleId, isActive: true, updatedAt: new Date().toISOString()}));
            const originalVehicles = prevVehicles.filter(v => v.UnitID === unit.UnitID);
            const softDeletedVehicles = originalVehicles.filter(v => !processedVehicles.some(p => p.VehicleId === v.VehicleId)).map(v => ({ ...v, isActive: false, updatedAt: new Date().toISOString() }));
            return [...otherVehicles, ...processedVehicles, ...softDeletedVehicles];
        });

        showToast('Đã lưu thông tin (tạm thời).', 'success');
    }, [showToast]);

    const handleResetResidents = useCallback((unitIds: Set<string>) => {
        const ownerIdsToReset = new Set<string>();
        
        setUnits(prev => {
            const newUnits = prev.map(u => {
                if (unitIds.has(u.UnitID)) {
                    ownerIdsToReset.add(u.OwnerID);
                    return { ...u, Status: 'Owner' as Unit['Status'] };
                }
                return u;
            });
            setOwners(prev => prev.map(o => ownerIdsToReset.has(o.OwnerID) ? { ...o, OwnerName: '[Trống]', Phone: '', Email: '' } : o));
            setVehicles(prev => prev.filter(v => !unitIds.has(v.UnitID)));
            return newUnits;
        });

        showToast(`Đã xoá thông tin của ${unitIds.size} hồ sơ (tạm thời).`, 'success');
    }, [showToast]);

    const handleImportData = useCallback(async (updates: any[]) => {
        if (!updates || updates.length === 0) {
            showToast('Không có dữ liệu để import.', 'info');
            return;
        }
    
        const batch = writeBatch(db);
        
        const currentUnits = [...units];
        const currentOwners = [...owners];
        const currentVehicles = [...vehicles];
        
        const nextUnits = [...units];
        const nextOwners = [...owners];
        const nextVehicles = [...vehicles];
    
        let createdCount = 0;
        let updatedCount = 0;
        let vehicleCount = 0;
    
        updates.forEach(update => {
            const unitId = String(update.unitId).trim();
            if (!unitId) return;
    
            let unit = currentUnits.find(u => u.UnitID === unitId);
    
            if (!unit) { // CREATE NEW
                const newOwnerId = `OWN_IMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const newOwner: Owner = {
                    OwnerID: newOwnerId,
                    OwnerName: update.ownerName || '[Chưa có tên]',
                    Phone: update.phone || '',
                    Email: update.email || '',
                };
                const ownerRef = doc(db, "owners", newOwnerId);
                batch.set(ownerRef, newOwner);
                nextOwners.push(newOwner);
    
                const newUnit: Unit = {
                    UnitID: unitId,
                    OwnerID: newOwnerId,
                    UnitType: unitId.startsWith('K') ? UnitType.KIOS : UnitType.APARTMENT,
                    Area_m2: parseFloat(update.area) || 0,
                    Status: update.status || 'Owner',
                };
                const unitRef = doc(db, "units", unitId);
                batch.set(unitRef, newUnit);
                nextUnits.push(newUnit);
                
                unit = newUnit;
                createdCount++;
    
            } else { // UPDATE EXISTING
                const unitChanges: Partial<Unit> = {};
                if (update.status) unitChanges.Status = update.status;
                if (update.area) unitChanges.Area_m2 = parseFloat(update.area) || unit.Area_m2;
    
                if (Object.keys(unitChanges).length > 0) {
                    const unitRef = doc(db, "units", unitId);
                    batch.update(unitRef, unitChanges);
                    
                    const unitIndex = nextUnits.findIndex(u => u.UnitID === unitId);
                    if (unitIndex !== -1) nextUnits[unitIndex] = { ...nextUnits[unitIndex], ...unitChanges };
                }
    
                const ownerChanges: Partial<Owner> = {};
                if (update.ownerName !== undefined) ownerChanges.OwnerName = update.ownerName;
                if (update.phone !== undefined) ownerChanges.Phone = update.phone;
                if (update.email !== undefined) ownerChanges.Email = update.email;
                
                if (Object.keys(ownerChanges).length > 0) {
                    const ownerRef = doc(db, "owners", unit.OwnerID);
                    batch.update(ownerRef, ownerChanges);
    
                    const ownerIndex = nextOwners.findIndex(o => o.OwnerID === unit!.OwnerID);
                    if (ownerIndex !== -1) nextOwners[ownerIndex] = { ...nextOwners[ownerIndex], ...ownerChanges };
                }
                updatedCount++;
            }
            
            if (update.vehicles && Array.isArray(update.vehicles)) {
                update.vehicles.forEach((vImport: { PlateNumber: string; Type: VehicleTier; VehicleName: string }) => {
                    const normPlate = String(vImport.PlateNumber || '').replace(/\s/g, '').toLowerCase();
                    if (!normPlate) return;
    
                    const existingVehicle = currentVehicles.find(v => v.PlateNumber.replace(/\s/g, '').toLowerCase() === normPlate);
                    
                    if (existingVehicle) {
                        const vehicleRef = doc(db, "vehicles", existingVehicle.VehicleId);
                        const vehicleChanges = {
                            UnitID: unitId,
                            isActive: true,
                            Type: vImport.Type || existingVehicle.Type,
                            VehicleName: vImport.VehicleName || existingVehicle.VehicleName,
                        };
                        batch.update(vehicleRef, vehicleChanges);
    
                        const vIndex = nextVehicles.findIndex(v => v.VehicleId === existingVehicle.VehicleId);
                        if (vIndex !== -1) nextVehicles[vIndex] = { ...nextVehicles[vIndex], ...vehicleChanges };
    
                    } else {
                        const newVehicleId = `VEH_IMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                        const newVehicle: Vehicle = {
                            VehicleId: newVehicleId,
                            UnitID: unitId,
                            PlateNumber: vImport.PlateNumber,
                            Type: vImport.Type,
                            VehicleName: vImport.VehicleName || '',
                            StartDate: new Date().toISOString().split('T')[0],
                            isActive: true,
                            documents: {},
                        };
                        const vehicleRef = doc(db, "vehicles", newVehicleId);
                        batch.set(vehicleRef, newVehicle);
                        nextVehicles.push(newVehicle);
                    }
                    vehicleCount++;
                });
            }
        });
    
        try {
            await batch.commit();
            setUnits(nextUnits);
            setOwners(nextOwners);
            setVehicles(nextVehicles);
            showToast(`Hoàn tất! Tạo mới ${createdCount}, cập nhật ${updatedCount} hộ. Xử lý ${vehicleCount} xe. Dữ liệu đã được lưu vào Firestore.`, 'success');
        } catch (error) {
            console.error("Firebase batch import error:", error);
            showToast("Lỗi khi lưu dữ liệu vào cơ sở dữ liệu. Vui lòng thử lại.", 'error');
        }
    
    }, [units, owners, vehicles, showToast]);
    
    const handleRestoreAllData = useCallback((data: AppData) => {
        if (data.units && Array.isArray(data.units)) {
            patchKiosAreas(data.units);
        }
        setUnits(data.units || []); 
        setOwners(data.owners || []); 
        setVehicles(data.vehicles || []);
        setWaterReadings(data.waterReadings || []); 
        setCharges(data.charges || []);
        setTariffs(data.tariffs || { service: [], parking: [], water: [] }); 
        setUsers(data.users || []);
        setAdjustments(data.adjustments || []); 
        setInvoiceSettings(data.invoiceSettings || initialInvoiceSettings);
        
        if (data.lockedPeriods) {
            localStorage.setItem('lockedBillingPeriods', JSON.stringify(data.lockedPeriods));
        }

        showToast('Dữ liệu đã được phục hồi (tạm thời)!', 'success');
    }, [showToast]);

    // --- PAGE RENDERING ---
    const renderPage = () => {
        switch (activePage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges} allData={{ units, owners, vehicles, waterReadings, tariffs, adjustments }} onUpdateAdjustments={handleSetAdjustments} role={role!} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} onSaveResident={handleSaveResident} onImportData={handleImportData} onDeleteResidents={handleResetResidents} role={role!} currentUser={currentUser!} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} onSetVehicles={handleSetVehicles} role={role!} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={handleSetWaterReadings} allUnits={units} role={role!} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs} role={role!} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers} role={role!} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={handleSetInvoiceSettings} role={role!} />;
            case 'backup': return <BackupRestorePage allData={{ units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings }} onRestore={handleRestoreAllData} role={role!} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={handleUndoAction} role={role!} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges}/>;
        }
    };

    const contextValue = useMemo<AppContextType>(() => ({ theme, toggleTheme, currentUser, role, setCurrentUser, showToast, switchUserRequest: handleSwitchUserRequest, logAction, logout: handleLogout, updateUser: handleUpdateUser }), [theme, currentUser, role, showToast, logAction, handleLogout, handleUpdateUser]);
    const processedFooter = useMemo(() => processFooterHtml(invoiceSettings.footerHtml), [invoiceSettings.footerHtml]);
    const footerStyle = useMemo<React.CSSProperties>(() => ({ display: toasts.length > 0 ? 'none' : 'flex', justifyContent: {left: 'flex-start', center: 'center', right: 'flex-end'}[invoiceSettings.footerAlign || 'center'], fontSize: {sm: '0.75rem', md: '0.875rem', lg: '1rem'}[invoiceSettings.footerFontSize || 'sm'] }), [toasts.length, invoiceSettings.footerAlign, invoiceSettings.footerFontSize]);
    
    if (loadingState === 'loading') {
        return <div className="flex h-screen w-screen items-center justify-center bg-light-bg dark:bg-dark-bg"><Spinner /></div>;
    }

    if (loadingState === 'error') {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-red-50 p-8 text-center text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <WarningIcon className="h-12 w-12 text-red-500" />
                <h1 className="mt-4 text-2xl font-bold">Mất kết nối máy chủ</h1>
                <p className="mt-2 max-w-md text-base">{errorMessage}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-6 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  Tải lại trang
                </button>
            </div>
        );
    }

    if (!currentUser) {
        return <AppContext.Provider value={contextValue}><LoginPage users={users} onLogin={handleInitialLogin} /><FooterToast toast={toasts[0] || null} onClose={handleCloseToast} /></AppContext.Provider>;
    }

    return (
        <AppContext.Provider value={contextValue}>
            <div className={`flex h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} role={role!}/>
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Header pageTitle={pageTitles[activePage]} theme={theme} toggleTheme={toggleTheme} currentUser={currentUser} allUsers={users} onSwitchUserRequest={handleSwitchUserRequest} />
                    <main className="flex-1 flex flex-col pt-3 px-4 sm:px-6 lg:px-8 overflow-y-auto bg-light-bg dark:bg-dark-bg">
                        <Suspense fallback={<div className="flex-grow flex items-center justify-center"><Spinner /></div>}>
                            {renderPage()}
                        </Suspense>
                    </main>
                    <footer id="appFooter" className="footer-default" style={footerStyle}><div dangerouslySetInnerHTML={{ __html: processedFooter }} /></footer>
                    <FooterToast toast={toasts[0] || null} onClose={handleCloseToast} />
                </div>
            </div>
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLoginAttempt} userToSwitchTo={userToSwitchTo} error={loginError} />
        </AppContext.Provider>
    );
};

export default App;
