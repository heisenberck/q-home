
import React, { useState, useEffect, useCallback, createContext, useContext, useMemo, lazy, Suspense } from 'react';
import type { Role, UserPermission, Unit, Owner, Vehicle, WaterReading, ChargeRaw, TariffService, TariffParking, TariffWater, Adjustment, InvoiceSettings, ActivityLog } from './types';
import { MOCK_USER_PERMISSIONS, MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, MOCK_CALCULATED_CHARGES, MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS, patchKiosAreas } from './constants';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import FooterToast, { type ToastMessage, type ToastType } from './components/ui/Toast';
import LoginModal from './components/ui/LoginModal';
import LoginPage from './components/pages/LoginPage';
import { processFooterHtml } from './utils/helpers';

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


const saspLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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
    updateUser: (updatedUser: UserPermission) => void; // Add this
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
    const [activePage, setActivePage] = useState<Page>('overview');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    // Data State (Centralized)
    const [units, setUnits] = useState<Unit[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [waterReadings, setWaterReadings] = useState<WaterReading[]>(MOCK_WATER_READINGS);
    const [charges, setCharges] = useState<ChargeRaw[]>(MOCK_CALCULATED_CHARGES);
    const [tariffs, setTariffs] = useState({
        service: MOCK_TARIFFS_SERVICE,
        parking: MOCK_TARIFFS_PARKING,
        water: MOCK_TARIFFS_WATER,
    });
    const [users, setUsers] = useState<UserPermission[]>(() => {
        // Robust initialization: Check if localStorage data is valid and contains at least one Admin
        const savedUsersStr = localStorage.getItem('hud3_users_v1');
        if (savedUsersStr) {
            try {
                const parsedUsers = JSON.parse(savedUsersStr);
                if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
                    // Check if default admin exists or any active admin exists
                    const hasAdmin = parsedUsers.some(u => u.Role === 'Admin' && u.status === 'Active');
                    if (hasAdmin) {
                        return parsedUsers;
                    }
                }
            } catch (e) {
                console.error("Failed to parse saved users from localStorage", e);
            }
        }
        // Fallback to MOCK if storage is empty, invalid, or missing Admin
        return MOCK_USER_PERMISSIONS;
    });

    const [adjustments, setAdjustments] = useState<Adjustment[]>(MOCK_ADJUSTMENTS);
    const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
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
        // NEW: Footer Defaults
        footerHtml: `© {{YEAR}} BQL Chung cư HUD3 Linh Đàm. Hotline: 0834.88.66.86`,
        footerShowInPdf: true,
        footerShowInEmail: true,
        footerShowInViewer: true,
        footerAlign: 'center',
        footerFontSize: 'sm',
    });
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const newToast: ToastMessage = {
            id: Date.now() + Math.random(),
            message,
            type,
            duration,
        };
        setToasts(prevToasts => [...prevToasts, newToast]);
    }, []);

    const handleCloseToast = useCallback(() => {
        setToasts(prevToasts => prevToasts.slice(1));
    }, []);


    // --- DATA PERSISTENCE ---
    useEffect(() => {
        try {
            const savedData = localStorage.getItem('hud3_residents_v2');
            const savedLogs = localStorage.getItem('hud3_activity_logs_v1');
            if (savedData) {
                const { units: savedUnits, owners: savedOwners, vehicles: savedVehicles } = JSON.parse(savedData);
                if (Array.isArray(savedUnits) && Array.isArray(savedOwners) && Array.isArray(savedVehicles)) {
                    patchKiosAreas(savedUnits);
                    setUnits(savedUnits);
                    setOwners(savedOwners);
                    setVehicles(savedVehicles);
                    console.log('Loaded resident data from localStorage.');
                }
            } else {
                 const initialUnits = MOCK_UNITS;
                patchKiosAreas(initialUnits);
                setUnits(initialUnits);
                setOwners(MOCK_OWNERS);
                setVehicles(MOCK_VEHICLES);
                console.log('Initialized with mock resident data.');
            }
             if (savedLogs) {
                setActivityLogs(JSON.parse(savedLogs));
                console.log('Loaded activity logs from localStorage.');
            }
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('hud3_activity_logs_v1', JSON.stringify(activityLogs));
        } catch (error) {
            console.error("Failed to save activity logs to localStorage", error);
        }
    }, [activityLogs]);

    // Persist users list when it changes (e.g. password change, status toggle)
    useEffect(() => {
        localStorage.setItem('hud3_users_v1', JSON.stringify(users));
    }, [users]);

    // --- RBAC & AUTH ---
    const [currentUser, setCurrentUser] = useState<UserPermission | null>(() => {
        const saved = localStorage.getItem('hud3_current_user');
        if (!saved) return null;
        try {
            const parsedUser = JSON.parse(saved);
            // Validation: Ensure user exists in the source of truth (users list) and is active
            // Since we can't access 'users' state here easily (closure), we re-fetch from source or MOCK
            const savedUsersList = localStorage.getItem('hud3_users_v1');
            // Use stricter fallback to ensure we don't validate against an empty list if storage is bad
            let validUsers = MOCK_USER_PERMISSIONS;
            if (savedUsersList) {
                const parsedList = JSON.parse(savedUsersList);
                if (Array.isArray(parsedList) && parsedList.length > 0) {
                    validUsers = parsedList;
                }
            }
            
            const validUser = validUsers.find((u: UserPermission) => u.Email === parsedUser.Email);
            
            if (validUser && validUser.status === 'Active') {
                return validUser; 
            }
        } catch (e) {
            console.error("Auth validation failed", e);
        }
        return null;
    });
    
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
        // Security Check: Validate against the current 'users' state to prevent using stale or fake user objects
        const validUser = users.find(u => u.Email === userToSwitchTo?.Email);
        
        if (!validUser) {
            setLoginError('Người dùng không tồn tại.');
            return;
        }
        
        if (validUser.status !== 'Active') {
            setLoginError('Tài khoản này đã bị vô hiệu hóa.');
            return;
        }

        const isMasterOverride = validUser.Role === 'Admin' && password === MASTER_PASSWORD;

        if (validUser.password === password || isMasterOverride) {
            setCurrentUser(validUser);
            localStorage.setItem('hud3_current_user', JSON.stringify(validUser));
            setIsLoginModalOpen(false);
            setUserToSwitchTo(null);
            setLoginError(null);
            showToast(`Đã chuyển sang người dùng ${validUser.Email}`, 'success');
        } else {
            setLoginError('Mật khẩu không đúng. Vui lòng thử lại.');
        }
    };

    const handleInitialLogin = (user: UserPermission) => {
        // Validation happens inside LoginPage generally, but good to double check or trust if passed from there
        setCurrentUser(user);
        localStorage.setItem('hud3_current_user', JSON.stringify(user));
        showToast(`Chào mừng quay trở lại, ${user.Email.split('@')[0]}!`, 'success');
    };

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem('hud3_current_user');
        showToast('Đã đăng xuất.', 'info');
    }, [showToast]);

    const handleUpdateUser = useCallback((updatedUser: UserPermission) => {
        setUsers(prev => prev.map(u => u.Email === updatedUser.Email || (currentUser && u.Email === currentUser.Email) ? updatedUser : u));
        // If updating self, update currentUser state too
        if (currentUser && (currentUser.Email === updatedUser.Email || currentUser.Email === updatedUser.Email)) {
             setCurrentUser(updatedUser);
             localStorage.setItem('hud3_current_user', JSON.stringify(updatedUser));
        }
    }, [currentUser]);

    // --- THEME EFFECT ---
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // --- ACTIVITY LOGGING (REFACTORED) ---
    const logAction = useCallback((payload: LogPayload) => {
        if (!currentUser) return;

        const UNDOABLE_ACTIONS = [
            'IMPORT_RESIDENTS', 'RESET_RESIDENTS', 'UPDATE_TARIFFS', 'RESTORE_DATA', 
            'BULK_UPDATE_CHARGE_STATUS', 'BULK_UPDATE_WATER_READINGS', 'BULK_UPDATE_USERS'
        ];
        
        const isUndoable = UNDOABLE_ACTIONS.includes(payload.action);
        const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const undoUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const newLog: ActivityLog = {
            id: logId,
            ts: new Date().toISOString(),
            actor_email: currentUser.Email,
            actor_role: currentUser.Role,
            undone: false,
            undo_token: isUndoable ? logId : null,
            undo_until: isUndoable ? undoUntil : null,
            ...payload,
        };
        
        setActivityLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
    }, [currentUser]);

    const handleUndoAction = useCallback((logId: string) => {
        const log = activityLogs.find(l => l.id === logId);
        if (!log || log.undone || !log.undo_token || new Date() > new Date(log.undo_until!)) {
            showToast('Hành động này không thể hoàn tác.', 'warn');
            return;
        }

        const { action, before_snapshot } = log;
        try {
            switch(action) {
                case 'BULK_UPDATE_CHARGE_STATUS':
                case 'CALCULATE_CHARGES':
                    setCharges(before_snapshot.charges);
                    break;
                case 'BULK_UPDATE_WATER_READINGS':
                    setWaterReadings(before_snapshot.waterReadings);
                    break;
                case 'UPDATE_TARIFFS':
                    setTariffs(before_snapshot.tariffs);
                    break;
                case 'UPDATE_ADJUSTMENTS':
                    setAdjustments(before_snapshot.adjustments);
                    break;
                case 'UPDATE_USERS':
                case 'BULK_UPDATE_USERS':
                    setUsers(before_snapshot.users);
                    break;
                case 'UPDATE_INVOICE_SETTINGS':
                    setInvoiceSettings(before_snapshot.invoiceSettings);
                    break;
                case 'UPDATE_RESIDENT':
                case 'RESET_RESIDENTS':
                case 'IMPORT_RESIDENTS':
                    setUnits(before_snapshot.units);
                    setOwners(before_snapshot.owners);
                    setVehicles(before_snapshot.vehicles);
                    break;
                case 'UPDATE_VEHICLES':
                    setVehicles(before_snapshot.vehicles);
                    break;
                case 'RESTORE_DATA':
                    handleRestoreAllData(before_snapshot.data, true); // Pass isUndo flag
                    break;
                default:
                    throw new Error(`Hành động không xác định: ${action}`);
            }
            
            setActivityLogs(prev => prev.map(l => l.id === logId ? { ...l, undone: true } : l));
            showToast('Hành động đã được hoàn tác.', 'success');

        } catch (error) {
            console.error("Undo failed:", error);
            showToast('Hoàn tác thất bại.', 'error');
        }
    }, [activityLogs, showToast]);

    // --- DATA HANDLERS (with logging) ---
     const handleSetCharges = useCallback((updater: React.SetStateAction<ChargeRaw[]>, logPayload?: LogPayload) => {
        if (logPayload) {
            setCharges(prevCharges => {
                const newCharges = typeof updater === 'function' ? (updater as (prev: ChargeRaw[]) => ChargeRaw[])(prevCharges) : updater;
                logAction({ ...logPayload, before_snapshot: { charges: prevCharges } });
                return newCharges;
            });
        } else {
            setCharges(updater);
        }
    }, [logAction]);
    
    const handleSetWaterReadings = useCallback((newReadings: WaterReading[], summary: string) => {
        logAction({
            module: 'Water', action: 'BULK_UPDATE_WATER_READINGS',
            summary, count: newReadings.length,
            before_snapshot: { waterReadings }
        });
        setWaterReadings(newReadings);
    }, [waterReadings, logAction]);
    
    const handleSetTariffs = useCallback((newTariffs: {service: TariffService[], parking: TariffParking[], water: TariffWater[]}) => {
        logAction({
            module: 'Pricing', action: 'UPDATE_TARIFFS', summary: 'Cập nhật biểu phí',
            before_snapshot: { tariffs }
        });
        setTariffs(newTariffs);
    }, [tariffs, logAction]);
    
    const handleSetAdjustments = useCallback((updater: React.SetStateAction<Adjustment[]>, summary: string) => {
        setAdjustments(prevAdjustments => {
            const newAdjustments = typeof updater === 'function' ? (updater as (prev: Adjustment[]) => Adjustment[])(prevAdjustments) : updater;
            if (JSON.stringify(prevAdjustments) !== JSON.stringify(newAdjustments)) {
                logAction({
                    module: 'Billing', action: 'UPDATE_ADJUSTMENTS', summary,
                    before_snapshot: { adjustments: prevAdjustments }
                });
            }
            return newAdjustments;
        });
    }, [logAction]);

    const handleSetUsers = useCallback((updater: React.SetStateAction<UserPermission[]>, logPayload?: LogPayload) => {
        if (logPayload) {
            setUsers(prevUsers => {
                const newUsers = typeof updater === 'function' ? (updater as (prev: UserPermission[]) => UserPermission[])(prevUsers) : updater;
                logAction({ ...logPayload, before_snapshot: { users: prevUsers } });
                return newUsers;
            });
        } else {
            setUsers(updater);
        }
    }, [logAction]);

    const handleSetInvoiceSettings = useCallback((newSettings: InvoiceSettings) => {
        logAction({
            module: 'Settings', action: 'UPDATE_INVOICE_SETTINGS', summary: 'Cập nhật cài đặt phiếu báo',
            before_snapshot: { invoiceSettings }
        });
        setInvoiceSettings(newSettings);
    }, [invoiceSettings, logAction]);

    const handleSetVehicles = useCallback((newVehicles: Vehicle[]) => {
        logAction({
            module: 'Vehicles', action: 'UPDATE_VEHICLES', summary: `Cập nhật ${newVehicles.length} phương tiện`,
            before_snapshot: { vehicles }
        });
        setVehicles(newVehicles);
    }, [vehicles, logAction]);
    
    const handleSaveResident = useCallback((updatedData: { unit: Unit; owner: Owner; vehicles: Vehicle[] }) => {
        logAction({
            module: 'Residents', action: 'UPDATE_RESIDENT', summary: `Cập nhật Cư dân ${updatedData.unit.UnitID}`,
            before_snapshot: { units, owners, vehicles }, ids: [updatedData.unit.UnitID]
        });
        const { unit, owner, vehicles: draftVehiclesFromModal } = updatedData;
        setUnits(prev => prev.map(u => u.UnitID === unit.UnitID ? unit : u));
        setOwners(prev => prev.map(o => o.OwnerID === owner.OwnerID ? owner : o));
        setVehicles(currentGlobalVehicles => {
            const otherUnitsVehicles = currentGlobalVehicles.filter(v => v.UnitID !== unit.UnitID);
            const processedDraftVehicles = draftVehiclesFromModal.map(v => ({
                ...v,
                VehicleId: v.VehicleId.startsWith('VEH_NEW_') ? `VEH${Math.floor(1000 + Math.random() * 9000)}` : v.VehicleId,
                isActive: true,
                updatedAt: new Date().toISOString(),
            }));
            const originalVehiclesForUnit = currentGlobalVehicles.filter(v => v.UnitID === unit.UnitID);
            const draftVehicleIds = new Set(processedDraftVehicles.map(v => v.VehicleId));
            const softDeletedVehicles = originalVehiclesForUnit
                .filter(v => !draftVehicleIds.has(v.VehicleId))
                .map(v => ({ ...v, isActive: false, updatedAt: new Date().toISOString() }));
            return [...otherUnitsVehicles, ...processedDraftVehicles, ...softDeletedVehicles];
        });
        showToast('Đã lưu thông tin vào hệ thống.', 'success');
    }, [showToast, units, owners, vehicles, logAction]);

    const handleResetResidents = useCallback((unitIdsToReset: Set<string>) => {
        logAction({
            module: 'Residents', action: 'RESET_RESIDENTS', summary: `Xoá thông tin của ${unitIdsToReset.size} hồ sơ`,
            before_snapshot: { units, owners, vehicles }, count: unitIdsToReset.size, ids: Array.from(unitIdsToReset)
        });
        const ownerIdsToReset = new Set<string>();
        const updatedUnits = units.map(unit => {
            if (unitIdsToReset.has(unit.UnitID)) {
                ownerIdsToReset.add(unit.OwnerID);
                return { ...unit, Status: 'Owner' };
            }
            return unit;
        });
        const updatedOwners = owners.map(owner => {
            if (ownerIdsToReset.has(owner.OwnerID)) {
                return { ...owner, OwnerName: '[Trống]', Phone: '', Email: '' };
            }
            return owner;
        });
        const updatedVehicles = vehicles.filter(v => !unitIdsToReset.has(v.UnitID));

        setUnits(updatedUnits);
        setOwners(updatedOwners);
        setVehicles(updatedVehicles);

        try {
            const dataToSave = { units: updatedUnits, owners: updatedOwners, vehicles: updatedVehicles };
            localStorage.setItem('hud3_residents_v2', JSON.stringify(dataToSave));
        } catch (error) {
            console.error("Failed to update localStorage after resident reset", error);
        }
        
        showToast(`Đã xoá thông tin của ${unitIdsToReset.size} hồ sơ cư dân.`, 'success');
    }, [units, owners, vehicles, showToast, logAction]);

    const handleImportData = useCallback((updates: { unitId: string; ownerName?: string; phone?: string; email?: string; status?: Unit['Status']; vehicles?: any[] }[]) => {
        if (!updates || updates.length === 0) {
            showToast('Không có dữ liệu hợp lệ để nhập.', 'info');
            return;
        }
        logAction({
            module: 'Residents', action: 'IMPORT_RESIDENTS', summary: `Nhập ${updates.length} hồ sơ từ CSV`,
            before_snapshot: { units, owners, vehicles }, count: updates.length
        });
    
        const newUnits = [...units];
        const newOwners = [...owners];
        let newVehicles = [...vehicles];
    
        const unitsMap = new Map(newUnits.map(u => [u.UnitID, u]));
        const ownersMap = new Map(newOwners.map(o => [o.OwnerID, o]));
        
        let updatedCount = 0;
        const unitsToUpdateVehicles = new Set<string>();
    
        for (const update of updates) {
            const unit = unitsMap.get(update.unitId);
            if (!unit) continue;
    
            let hasUpdate = false;
            if (update.ownerName || update.phone || update.email || update.status || update.vehicles) { hasUpdate = true; }
            if (update.status) { unit.Status = update.status; }
    
            const owner = ownersMap.get(unit.OwnerID);
            if (owner) {
                if (update.ownerName) owner.OwnerName = update.ownerName;
                if (update.phone) owner.Phone = update.phone;
                if (update.email) owner.Email = update.email;
            }
            
            if (update.vehicles) { unitsToUpdateVehicles.add(update.unitId); }
            if (hasUpdate) updatedCount++;
        }
        
        newVehicles = newVehicles.filter(v => !unitsToUpdateVehicles.has(v.UnitID));
        for (const update of updates) {
            if (update.vehicles && unitsToUpdateVehicles.has(update.unitId)) {
                const vehiclesToAdd = update.vehicles.map((v: any) => ({
                    VehicleId: `VEH_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    UnitID: update.unitId,
                    Type: v.Type,
                    VehicleName: v.VehicleName || '',
                    PlateNumber: v.PlateNumber || 'N/A',
                    StartDate: new Date().toISOString().split('T')[0],
                    isActive: true,
                }));
                newVehicles.push(...vehiclesToAdd);
            }
        }
    
        setUnits(newUnits);
        setOwners(newOwners);
        setVehicles(newVehicles);
    
        try {
            const dataToSave = { units: newUnits, owners: newOwners, vehicles: newVehicles };
            localStorage.setItem('hud3_residents_v2', JSON.stringify(dataToSave));
            showToast(`Đã nhập và cập nhật ${updatedCount} hồ sơ.`, 'success');
        } catch (e) {
            showToast('Lỗi khi lưu dữ liệu đã nhập.', 'error');
        }
    }, [units, owners, vehicles, showToast, logAction]);
    
    const handleRestoreAllData = useCallback((data: any, isUndo: boolean = false) => {
        if (!data.units || !data.owners || !data.tariffs) {
            showToast('File backup không hợp lệ.', 'error');
            return;
        }

        if (!isUndo) {
            logAction({
                module: 'System', action: 'RESTORE_DATA', 
                summary: `Phục hồi từ file backup ngày ${new Date(data.backupDate).toLocaleString('vi-VN')}`,
                before_snapshot: { data: { units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings } }
            });
        }

        patchKiosAreas(data.units);
        setUnits(data.units);
        setOwners(data.owners);
        setVehicles(data.vehicles || []);
        setWaterReadings(data.waterReadings || []);
        setCharges(data.charges || []);
        setTariffs(data.tariffs || { service: [], parking: [], water: [] });
        setUsers(data.users || []);
        setAdjustments(data.adjustments || []);
        setInvoiceSettings(data.invoiceSettings || {});

        if (data.lockedPeriods) {
            localStorage.setItem('lockedBillingPeriods', JSON.stringify(data.lockedPeriods));
        }
        
        try {
            localStorage.setItem('hud3_residents_v2', JSON.stringify({ units: data.units, owners: data.owners, vehicles: data.vehicles || [] }));
        } catch (e) {
            console.error('Failed to save restored resident data to localStorage', e);
        }

        showToast('Dữ liệu đã được phục hồi thành công!', 'success');
    }, [showToast, logAction, units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings]);

    // --- PAGE RENDERING ---
    const renderPage = () => {
        switch (activePage) {
            case 'overview': return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges} />;
            case 'billing': return <BillingPage charges={charges} setCharges={handleSetCharges} allData={{ units, owners, vehicles, waterReadings, tariffs, adjustments }} onUpdateAdjustments={handleSetAdjustments} role={role!} invoiceSettings={invoiceSettings} />;
            case 'residents': return <ResidentsPage units={units} owners={owners} vehicles={vehicles} onSaveResident={handleSaveResident} onImportData={handleImportData} onDeleteResidents={handleResetResidents} role={role!} currentUser={currentUser!} />;
            case 'vehicles': return <VehiclesPage vehicles={vehicles} units={units} owners={owners} onSetVehicles={handleSetVehicles} role={role!} />;
            case 'water': return <WaterPage waterReadings={waterReadings} setWaterReadings={(updater) => setWaterReadings(updater(waterReadings))} allUnits={units} role={role!} />;
            case 'pricing': return <PricingPage tariffs={tariffs} setTariffs={handleSetTariffs} role={role!} />;
            case 'users': return <UsersPage users={users} setUsers={handleSetUsers} role={role!} />;
            case 'settings': return <SettingsPage invoiceSettings={invoiceSettings} setInvoiceSettings={handleSetInvoiceSettings} role={role!} />;
            case 'backup':
                const allCurrentData = { units, owners, vehicles, waterReadings, charges, tariffs, users, adjustments, invoiceSettings };
                return <BackupRestorePage allData={allCurrentData} onRestore={handleRestoreAllData} role={role!} />;
            case 'activityLog': return <ActivityLogPage logs={activityLogs} onUndo={handleUndoAction} role={role!} />;
            default: return <OverviewPage allUnits={units} allOwners={owners} allVehicles={vehicles} allWaterReadings={waterReadings} charges={charges}/>;
        }
    };

    const contextValue = useMemo<AppContextType>(() => ({
        theme,
        toggleTheme,
        currentUser,
        role,
        setCurrentUser,
        showToast,
        switchUserRequest: handleSwitchUserRequest,
        logAction,
        logout: handleLogout,
        updateUser: handleUpdateUser
    }), [theme, currentUser, role, showToast, logAction, handleLogout, handleUpdateUser]);

    const processedFooter = useMemo(() => processFooterHtml(invoiceSettings.footerHtml), [invoiceSettings.footerHtml]);

    const footerStyle = useMemo<React.CSSProperties>(() => {
        const justifyContent = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end',
        }[invoiceSettings.footerAlign || 'center'];

        const fontSize = {
            sm: '0.75rem', // 12px
            md: '0.875rem', // 14px
            lg: '1rem',    // 16px
        }[invoiceSettings.footerFontSize || 'sm'];

        return {
            display: toasts.length > 0 ? 'none' : 'flex',
            justifyContent: justifyContent,
            fontSize: fontSize,
        };
    }, [toasts.length, invoiceSettings.footerAlign, invoiceSettings.footerFontSize]);

    // --- CONDITIONAL RENDER FOR LOGIN ---
    if (!currentUser) {
        return (
            <AppContext.Provider value={contextValue}>
                <LoginPage users={users} onLogin={handleInitialLogin} />
                <FooterToast toast={toasts[0] || null} onClose={handleCloseToast} />
            </AppContext.Provider>
        );
    }

    return (
        <AppContext.Provider value={contextValue}>
            <div className={`flex h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary transition-colors duration-300`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} role={role!}/>
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Header 
                        pageTitle={pageTitles[activePage]} 
                        theme={theme} 
                        toggleTheme={toggleTheme} 
                        currentUser={currentUser} 
                        allUsers={users} 
                        onSwitchUserRequest={handleSwitchUserRequest} 
                    />
                    <main className="flex-1 flex flex-col pt-3 px-4 sm:px-6 lg:px-8 overflow-y-auto bg-light-bg dark:bg-dark-bg">
                        <Suspense fallback={<div className="flex-grow flex items-center justify-center"><p>Loading...</p></div>}>
                            {renderPage()}
                        </Suspense>
                    </main>
                    <footer id="appFooter" className="footer-default" style={footerStyle}>
                      <div dangerouslySetInnerHTML={{ __html: processedFooter }} />
                    </footer>
                    <FooterToast toast={toasts[0] || null} onClose={handleCloseToast} />
                </div>
            </div>
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLogin={handleLoginAttempt}
                userToSwitchTo={userToSwitchTo}
                error={loginError}
            />
        </AppContext.Provider>
    );
};

export default App;
