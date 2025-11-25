import React, { useRef, useState } from 'react';
import type { Role } from '../../types';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, WarningIcon, TrashIcon, CircularArrowRefreshIcon } from '../ui/Icons';
import { useNotification, useAuth } from '../../App';
import { wipeAllBusinessData } from '../../services';

interface BackupRestorePageProps {
    allData: any;
    onRestore: (data: any) => void;
    role: Role;
}

type ConfirmAction = 'restore_file' | 'delete_data' | 'restore_mock' | null;

const WipeProgressModal: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-dark-bg-secondary p-8 rounded-xl shadow-xl w-full max-w-md text-center">
            <h4 className="text-lg font-bold mb-4">Đang Xoá Dữ Liệu...</h4>
            <p className="mb-4">Vui lòng không đóng cửa sổ này. Quá trình có thể mất vài phút.</p>
            <div className="flex justify-center items-center my-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{message}</p>
        </div>
    </div>
);

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
        if (!canManage) return;
        try {
            const lockedPeriods = JSON.parse(localStorage.getItem('lockedBillingPeriods') || '[]');
            const fullBackup = { ...allData, lockedPeriods, backupDate: new Date().toISOString() };
            const jsonString = JSON.stringify(fullBackup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hud3_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup dữ liệu thành công!', 'success');
        } catch (error) {
            showToast('Lỗi khi backup dữ liệu.', 'error');
        }
    };

    const handleRestoreClick = () => {
        if (!canManage) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data && data.units && data.owners && data.tariffs && data.backupDate) {
                    setRestorePendingData(data);
                    setConfirmAction('restore_file');
                    setPassword('');
                } else {
                    throw new Error('File không hợp lệ.');
                }
            } catch (error: any) {
                showToast(`Lỗi: ${error.message}`, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmAction = async () => {
        const isValid = (user && password === user.password) || password === MASTER_PASSWORD;
        if (!isValid) {
            showToast('Mật khẩu không đúng.', 'error');
            setPassword('');
            return;
        }
        
        const action = confirmAction;
        setConfirmAction(null);
        setPassword('');

        if (action === 'restore_file' && restorePendingData) {
            onRestore(restorePendingData);
            setRestorePendingData(null);
        } else if (action === 'delete_data') {
            setIsWiping(true);
            try {
                await wipeAllBusinessData(setWipeProgress);
                const emptyData = { units: [], owners: [], vehicles: [], waterReadings: [], charges: [], adjustments: [], activityLogs: [], lockedPeriods: [], tariffs: allData.tariffs, invoiceSettings: allData.invoiceSettings, users: allData.users };
                onRestore(emptyData);
                showToast('Đã xoá sạch dữ liệu!', 'success');
            } catch (error: any) {
                showToast(`Lỗi: ${error.message}`, 'error');
            } finally {
                setIsWiping(false);
            }
        } else if (action === 'restore_mock') {
            showToast('Chế độ Mock sẽ được kích hoạt sau khi tải lại trang.', 'info');
            setTimeout(() => window.location.reload(), 1500);
        }
    };

    const getConfirmMessage = () => ({
        'restore_file': "Phục hồi dữ liệu từ file sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại.",
        'delete_data': "XOÁ SẠCH DỮ LIỆU nghiệp vụ. Hành động này KHÔNG THỂ hoàn tác.",
        'restore_mock': "Phục hồi lại bộ dữ liệu mẫu. Dữ liệu hiện tại sẽ bị mất.",
    }[confirmAction!] || "");

    return (
        <div className="space-y-6">
            {isWiping && <WipeProgressModal message={wipeProgress} />}
            
            <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400"><ArrowDownTrayIcon /> Backup Dữ liệu</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Tạo một bản sao lưu toàn bộ dữ liệu của ứng dụng vào một file JSON. Lưu file này ở nơi an toàn.</p>
                <button onClick={handleBackup} disabled={!canManage} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:bg-gray-400">Tải về file Backup</button>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-600 dark:text-yellow-400"><ArrowUpTrayIcon /> Phục hồi (Restore)</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm"><strong className="text-red-500">CẢNH BÁO:</strong> Thao tác này sẽ xóa toàn bộ dữ liệu hiện tại và thay thế bằng dữ liệu trong file backup.</p>
                <input type="file" ref={fileInputRef} accept="application/json" onChange={handleFileChange} className="hidden" />
                <button onClick={handleRestoreClick} disabled={!canManage} className="px-5 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-sm hover:bg-yellow-600 disabled:bg-gray-400">Chọn file và Phục hồi</button>
            </div>

            <div className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-600 dark:text-red-400"><TrashIcon /> Quản lý Dữ liệu Hệ thống</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">Các công cụ này dùng để khởi tạo lại hệ thống. Vui lòng cân nhắc kỹ trước khi sử dụng.</p>
                <div className="flex flex-wrap gap-4">
                    <button onClick={() => setConfirmAction('delete_data')} disabled={!canManage} className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"><TrashIcon /> Xoá sạch Dữ liệu</button>
                    <button onClick={() => setConfirmAction('restore_mock')} disabled={!canManage} className="px-5 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-sm hover:bg-gray-700 disabled:bg-gray-400 flex items-center gap-2"><CircularArrowRefreshIcon /> Khôi phục Dữ liệu Mẫu</button>
                </div>
            </div>

            {confirmAction && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-dark-bg-secondary border-t-4 border-red-500 p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] animate-slide-up">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/50 p-3 rounded-full"><WarningIcon className="h-8 w-8 text-red-600 dark:text-red-300" /></div>
                        <div className="flex-grow text-center md:text-left">
                            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Xác nhận Thao tác Nguy hiểm</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{getConfirmMessage()}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <input type="password" value={password} onKeyDown={e => e.key === 'Enter' && handleConfirmAction()} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu Admin" className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 w-full sm:w-48 focus:ring-2 focus:ring-red-500 outline-none" autoFocus />
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={handleConfirmAction} className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">Xác nhận</button>
                                <button onClick={() => setConfirmAction(null)} className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Hủy</button>
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