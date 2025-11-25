import React, { useRef, useState } from 'react';
import type { Role } from '../../types';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, WarningIcon, TrashIcon, CircularArrowRefreshIcon } from '../ui/Icons';
import { useNotification, useAuth } from '../../App';
import { 
    MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES, MOCK_WATER_READINGS, 
    MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER, MOCK_ADJUSTMENTS,
    patchKiosAreas
} from '../../constants';
import { db } from '../../firebaseConfig';
import { collection, query, getDocs, writeBatch } from "firebase/firestore";

interface BackupRestorePageProps {
    allData: any; // A collection of all application data
    onRestore: (data: any) => void;
    role: Role;
}

type ConfirmAction = 'restore_file' | 'delete_data' | 'restore_mock' | null;

// --- START: New Components for Wipe Data feature ---
const WipeProgressModal: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-8 rounded-lg shadow-xl w-full max-w-md text-center">
            <h4 className="text-lg font-bold mb-4">Đang Xoá Dữ Liệu...</h4>
            <p className="mb-4">Vui lòng không đóng cửa sổ này. Quá trình có thể mất vài phút.</p>
            <div className="flex justify-center items-center my-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{message}</p>
        </div>
    </div>
);
// --- END: New Components for Wipe Data feature ---


const BackupRestorePage: React.FC<BackupRestorePageProps> = ({ allData, onRestore, role }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canManage = role === 'Admin';
    
    const [restorePendingData, setRestorePendingData] = useState<any | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [password, setPassword] = useState('');
    
    const [isWiping, setIsWiping] = useState(false);
    const [wipeProgress, setWipeProgress] = useState('');

    const MASTER_PASSWORD = '123456a@A';

    const handleBackup = () => {
        if (!canManage) {
            showToast('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }

        try {
            // Include data from localStorage that isn't in React state
            const lockedPeriods = JSON.parse(localStorage.getItem('lockedBillingPeriods') || '[]');

            const fullBackup = {
                ...allData,
                lockedPeriods,
                backupDate: new Date().toISOString(),
            };

            const jsonString = JSON.stringify(fullBackup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hud3_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Backup dữ liệu thành công!', 'success');
        } catch (error) {
            console.error("Backup failed:", error);
            showToast('Đã xảy ra lỗi khi backup dữ liệu.', 'error');
        }
    };

    const handleRestoreClick = () => {
        if (!canManage) {
            showToast('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);

                // Simple validation
                if (data && data.units && data.owners && data.tariffs && data.backupDate) {
                    setRestorePendingData(data);
                    setConfirmAction('restore_file');
                    setPassword('');
                } else {
                    throw new Error('File không hợp lệ hoặc không phải file backup.');
                }
            } catch (error: any) {
                showToast(`Lỗi khi đọc file: ${error.message}`, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteDataClick = () => {
        if (!canManage) return;
        setConfirmAction('delete_data');
        setPassword('');
    };

    const handleRestoreMockDataClick = () => {
        if (!canManage) return;
        setConfirmAction('restore_mock');
        setPassword('');
    };

    const wipeAllBusinessData = async (progressCallback: (message: string) => void) => {
        const collectionsToDelete = [
            'charges', 'waterReadings', 'vehicles', 
            'adjustments', 'owners', 'units', 'activityLogs'
        ];
        
        for (const collectionName of collectionsToDelete) {
            progressCallback(`Đang chuẩn bị xoá: ${collectionName}...`);
            const q = query(collection(db, collectionName));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                progressCallback(`Collection '${collectionName}' trống. Bỏ qua.`);
                continue;
            }
    
            const BATCH_SIZE = 500;
            let batch = writeBatch(db);
            let count = 0;
            let totalDeleted = 0;
    
            for (const docSnapshot of querySnapshot.docs) {
                batch.delete(docSnapshot.ref);
                count++;
                if (count === BATCH_SIZE) {
                    await batch.commit();
                    totalDeleted += count;
                    progressCallback(`Đã xoá ${totalDeleted}/${querySnapshot.size} từ '${collectionName}'`);
                    batch = writeBatch(db);
                    count = 0;
                }
            }
    
            if (count > 0) {
                await batch.commit();
                totalDeleted += count;
                progressCallback(`Hoàn tất xoá ${totalDeleted}/${querySnapshot.size} từ '${collectionName}'`);
            }
        }
    };

    const handleConfirmAction = async () => {
        const isValid = (user && password === user.password) || password === MASTER_PASSWORD;

        if (!isValid) {
            showToast('Mật khẩu không đúng. Thao tác đã bị huỷ.', 'error');
            setPassword('');
            return;
        }
        
        const actionToPerform = confirmAction;
        const dataToRestore = restorePendingData;

        // Immediately hide confirmation UI
        setPassword('');
        setConfirmAction(null);
        setRestorePendingData(null);

        if (actionToPerform === 'restore_file' && dataToRestore) {
            onRestore(dataToRestore);
            showToast('Đã phục hồi dữ liệu từ file backup.', 'success');
        } else if (actionToPerform === 'delete_data') {
            setIsWiping(true);
            try {
                await wipeAllBusinessData(setWipeProgress);
                
                const emptyData = {
                    units: [], owners: [], vehicles: [], waterReadings: [], charges: [],
                    adjustments: [], activityLogs: [], lockedPeriods: [],
                    tariffs: allData.tariffs, invoiceSettings: allData.invoiceSettings,
                    users: allData.users, backupDate: new Date().toISOString()
                };
                onRestore(emptyData);
                showToast('Đã xoá sạch dữ liệu nghiệp vụ thành công!', 'success');
            } catch (error: any) {
                console.error("Wipe data failed:", error);
                showToast(`Lỗi khi xoá dữ liệu: ${error.message}`, 'error');
            } finally {
                setIsWiping(false);
                setWipeProgress('');
            }
        } else if (actionToPerform === 'restore_mock') {
            const freshUnits = JSON.parse(JSON.stringify(MOCK_UNITS));
            patchKiosAreas(freshUnits);
            const mockDataState = {
                units: freshUnits, owners: MOCK_OWNERS, vehicles: MOCK_VEHICLES,
                waterReadings: MOCK_WATER_READINGS, charges: [], adjustments: MOCK_ADJUSTMENTS,
                tariffs: { service: MOCK_TARIFFS_SERVICE, parking: MOCK_TARIFFS_PARKING, water: MOCK_TARIFFS_WATER },
                invoiceSettings: allData.invoiceSettings, users: allData.users,
                activityLogs: [], lockedPeriods: [], backupDate: new Date().toISOString()
            };
            onRestore(mockDataState);
            showToast('Đã phục hồi dữ liệu mẫu thành công.', 'success');
        }
    };
    
    const handleCancel = () => {
        setConfirmAction(null);
        setRestorePendingData(null);
        setPassword('');
        showToast('Đã hủy thao tác.', 'info');
    };

    const getConfirmMessage = () => {
        switch (confirmAction) {
            case 'restore_file':
                return "Phục hồi dữ liệu từ file backup. Hành động này sẽ ghi đè toàn bộ dữ liệu hiện tại.";
            case 'delete_data':
                return "XOÁ SẠCH DỮ LIỆU nghiệp vụ (Cư dân, Xe, Nước, Phí...). Biểu giá, Cài đặt và Tài khoản sẽ được giữ nguyên. Hành động này KHÔNG THỂ hoàn tác.";
            case 'restore_mock':
                return "Phục hồi lại bộ dữ liệu mẫu (Mock Data) ban đầu. Dữ liệu hiện tại sẽ bị mất.";
            default:
                return "";
        }
    };

    return (
        <div className="space-y-8">
             <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
            
            {isWiping && <WipeProgressModal message={wipeProgress} />}
            
            {/* Backup Section */}
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <ArrowDownTrayIcon /> Backup Dữ liệu
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Tạo một bản sao lưu toàn bộ dữ liệu của ứng dụng (cư dân, phí, cài đặt, v.v.) vào một file JSON. Lưu file này ở nơi an toàn.
                </p>
                <button
                    onClick={handleBackup}
                    disabled={!canManage}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"
                >
                    Tải về file Backup
                </button>
            </div>

            {/* Restore Section */}
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <ArrowUpTrayIcon /> Phục hồi (Restore)
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Phục hồi dữ liệu từ một file backup JSON. <strong className="text-red-500">CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu hiện tại và thay thế bằng dữ liệu trong file backup.</strong>
                </p>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/json"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button
                    onClick={handleRestoreClick}
                    disabled={!canManage}
                    className="px-6 py-2 bg-yellow-600 text-white font-bold rounded-md shadow-sm hover:bg-yellow-700 disabled:bg-gray-400"
                >
                    Chọn file và Phục hồi
                </button>
            </div>

            {/* Initialization / Clean Section */}
            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-6 rounded-lg shadow-md border-l-4 border-red-500">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
                    <TrashIcon /> Quản lý Dữ liệu Hệ thống
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                    Các công cụ này dùng để khởi tạo lại hệ thống. Vui lòng cân nhắc kỹ trước khi sử dụng.
                </p>
                
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={handleDeleteDataClick}
                        disabled={!canManage}
                        className="px-6 py-2 bg-red-600 text-white font-bold rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        <TrashIcon className="w-5 h-5" /> Xoá sạch Dữ liệu
                    </button>
                    
                    <button
                        onClick={handleRestoreMockDataClick}
                        disabled={!canManage}
                        className="px-6 py-2 bg-gray-600 text-white font-bold rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        <CircularArrowRefreshIcon className="w-5 h-5" /> Khôi phục Dữ liệu Mẫu
                    </button>
                </div>
            </div>

            {/* Confirmation Footer/Modal */}
            {confirmAction && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-bg-secondary border-t-4 border-red-500 p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] animate-slide-up">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                             <WarningIcon className="h-8 w-8 text-red-600 dark:text-red-300" />
                        </div>
                        <div className="flex-grow text-center md:text-left">
                            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Xác nhận Thao tác Nguy hiểm</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                {getConfirmMessage()}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <input 
                                type="password"
                                value={password}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmAction()}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mật khẩu Admin"
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 w-full sm:w-48 focus:ring-2 focus:ring-red-500 outline-none"
                                autoFocus
                            />
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={handleConfirmAction} className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 whitespace-nowrap">
                                    Xác nhận
                                </button>
                                <button onClick={handleCancel} className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                                    Hủy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!canManage && <p className="text-red-600 text-center font-semibold mt-8">Chỉ Admin mới có quyền truy cập chức năng này.</p>}
        </div>
    );
};

export default BackupRestorePage;
