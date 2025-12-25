
import React, { useRef, useState, useEffect } from 'react';
import type { Role, ChargeRaw, MiscRevenue, OperationalExpense } from '../../types';
import { 
    ArrowDownTrayIcon, ArrowUpTrayIcon, WarningIcon, TrashIcon, 
    CircularArrowRefreshIcon, CloudArrowUpIcon, CalendarDaysIcon,
    CheckCircleIcon, ClockIcon, XMarkIcon, BanknotesIcon,
    TrendingDownIcon, SparklesIcon, ChevronLeftIcon, ChevronRightIcon,
    SaveIcon
} from '../ui/Icons';
import { useNotification, useAuth, useSettings } from '../../App';
import { wipeAllBusinessData } from '../../services';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { formatCurrency } from '../../utils/helpers';
import Spinner from '../ui/Spinner';

interface BackupRestorePageProps {
    allData: any;
    onRestore: (data: any) => void;
    role: Role;
}

type ConfirmAction = 'restore_file' | 'delete_data' | 'restore_mock' | null;
type BackupStatus = 'idle' | 'loading' | 'success' | 'error';

const WipeProgressModal: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
            <h4 className="text-lg font-bold mb-4">Đang Xoá Dữ Liệu...</h4>
            <p className="mb-4">Vui lòng không đóng cửa sổ này. Quá trình có thể mất vài phút.</p>
            <div className="flex justify-center items-center my-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
            <p className="text-sm text-gray-600 font-mono">{message}</p>
        </div>
    </div>
);

const BackupRestorePage: React.FC<BackupRestorePageProps> = ({ allData, onRestore, role }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const { invoiceSettings, setInvoiceSettings } = useSettings();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canManage = role === 'Admin';
    
    const [restorePendingData, setRestorePendingData] = useState<any | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [password, setPassword] = useState('');
    
    const [isWiping, setIsWiping] = useState(false);
    const [wipeProgress, setWipeProgress] = useState('');

    // --- Financial Backup States ---
    const [gasUrl, setGasUrl] = useState(localStorage.getItem('google_script_url') || invoiceSettings.appsScriptUrl || '');
    const [isSavingUrl, setIsSavingUrl] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [moduleStatuses, setModuleStatuses] = useState<Record<string, BackupStatus>>({
        billing: 'idle',
        vas: 'idle',
        expenses: 'idle'
    });

    const MASTER_PASSWORD = '123456a@A';

    const handleSaveGasUrl = async () => {
        if (!gasUrl.trim()) {
            showToast('Vui lòng nhập URL Apps Script.', 'warn');
            return;
        }
        setIsSavingUrl(true);
        try {
            // 1. Lưu vào localStorage để truy cập nhanh
            localStorage.setItem('google_script_url', gasUrl);
            
            // 2. Lưu vào Cloud Settings thông qua Context
            await setInvoiceSettings({
                ...invoiceSettings,
                appsScriptUrl: gasUrl
            });
            
            showToast('Đã lưu cấu hình Apps Script URL.', 'success');
        } catch (error) {
            showToast('Lỗi khi lưu cấu hình.', 'error');
        } finally {
            setIsSavingUrl(false);
        }
    };

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

    // --- Google Sheets Backup Logic ---
    const handleGoogleSheetsBackup = async (moduleId: 'billing' | 'vas' | 'expenses') => {
        const currentGasUrl = gasUrl || invoiceSettings.appsScriptUrl;
        if (!currentGasUrl?.trim()) {
            showToast('Vui lòng nhập và LƯU Google Apps Script URL trước.', 'warn');
            return;
        }

        setModuleStatuses(prev => ({ ...prev, [moduleId]: 'loading' }));
        
        try {
            let collectionName = '';
            let payload: any = { action_type: 'SYNC_BULK', period: selectedPeriod, module: moduleId };
            
            if (moduleId === 'billing') {
                collectionName = 'charges';
                const q = query(collection(db, collectionName), where('Period', '==', selectedPeriod));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data() as ChargeRaw);
                payload.headers = ["Mã căn", "Tháng", "Phí QL", "Phí gửi xe", "Phí nước", "Tổng cộng", "Đã nộp", "Chênh lệch", "Trạng thái"];
                payload.rows = data.map(c => [
                    c.UnitID, c.Period, c.ServiceFee_Total, c.ParkingFee_Total, 
                    c.WaterFee_Total, c.TotalDue, c.TotalPaid, c.TotalPaid - c.TotalDue, c.paymentStatus
                ]);
            } else if (moduleId === 'vas') {
                collectionName = 'misc_revenues';
                const q = query(
                    collection(db, collectionName), 
                    where('date', '>=', selectedPeriod), 
                    where('date', '<=', selectedPeriod + '\uf8ff')
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data() as MiscRevenue);
                payload.headers = ["Ngày", "Hạng mục", "Nội dung", "Số tiền", "Người tạo"];
                payload.rows = data.map(r => [r.date, r.type, r.description, r.amount, r.createdBy]);
            } else {
                collectionName = 'operational_expenses';
                const q = query(
                    collection(db, collectionName), 
                    where('date', '>=', selectedPeriod), 
                    where('date', '<=', selectedPeriod + '\uf8ff')
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data() as OperationalExpense);
                payload.headers = ["Ngày", "Hạng mục", "Nội dung", "Số tiền", "Người chi"];
                payload.rows = data.map(e => [e.date, e.category, e.description, e.amount, e.performedBy]);
            }

            if (payload.rows.length === 0) {
                showToast(`Kỳ ${selectedPeriod} không có dữ liệu cho module này.`, 'info');
                setModuleStatuses(prev => ({ ...prev, [moduleId]: 'idle' }));
                return;
            }

            // Send to GAS
            const response = await fetch(currentGasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action_type: 'SYNC_BULK',
                    payload: JSON.stringify(payload)
                })
            });

            if (response.ok) {
                setModuleStatuses(prev => ({ ...prev, [moduleId]: 'success' }));
                showToast('Đã sao lưu lên Google Sheets thành công.', 'success');
            } else {
                throw new Error('GAS response failed');
            }

        } catch (error) {
            console.error(error);
            setModuleStatuses(prev => ({ ...prev, [moduleId]: 'error' }));
            showToast('Lỗi khi gửi dữ liệu sang Google Sheets.', 'error');
        }
    };

    const renderStatus = (status: BackupStatus) => {
        switch (status) {
            case 'loading': return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>;
            case 'success': return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
            case 'error': return <WarningIcon className="w-5 h-5 text-red-500" />;
            default: return <ClockIcon className="w-5 h-5 text-gray-300" />;
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {isWiping && <WipeProgressModal message={wipeProgress} />}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* JSON Backup */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-blue-600">
                        <ArrowDownTrayIcon className="w-6 h-6" /> Sao lưu hệ thống (JSON)
                    </h3>
                    <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                        Tải toàn bộ cấu hình, đơn giá và hồ sơ cư dân về máy dưới định dạng JSON. Nên thực hiện định kỳ hàng tuần.
                    </p>
                    <button onClick={handleBackup} disabled={!canManage} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-200 transition-all active:scale-95">
                        Tải file Backup (.json)
                    </button>
                </div>

                {/* Phục hồi */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-amber-600">
                        <ArrowUpTrayIcon className="w-6 h-6" /> Phục hồi dữ liệu
                    </h3>
                    <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                        <strong className="text-red-500">CẢNH BÁO:</strong> Thao tác này sẽ xóa toàn bộ dữ liệu hiện tại và thay thế bằng dữ liệu trong file.
                    </p>
                    <input type="file" ref={fileInputRef} accept="application/json" onChange={handleFileChange} className="hidden" />
                    <button onClick={handleRestoreClick} disabled={!canManage} className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-100 hover:bg-amber-600 disabled:bg-gray-200 transition-all active:scale-95">
                        Chọn file JSON để khôi phục
                    </button>
                </div>
            </div>

            {/* NEW: Financial Backup to Google Sheets */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-3 text-emerald-600">
                            <CloudArrowUpIcon className="w-6 h-6" /> Sao lưu Tài chính sang Google Sheets
                        </h3>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Xuất dữ liệu thô sang bảng tính trực tuyến</p>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1 rounded-xl items-center border border-slate-200">
                        <button onClick={() => setSelectedPeriod(p => { const d = new Date(p+'-02'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500"><ChevronLeftIcon className="w-4 h-4"/></button>
                        <div className="px-4 py-1.5 flex items-center gap-2 text-sm font-black text-gray-700">
                            <CalendarDaysIcon className="w-4 h-4 text-emerald-600" />
                            {selectedPeriod}
                        </div>
                        <button onClick={() => setSelectedPeriod(p => { const d = new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); })} className="p-2 hover:bg-white rounded-lg transition-all text-gray-500"><ChevronRightIcon className="w-4 h-4"/></button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Google Apps Script URL</label>
                            <div className="flex gap-2">
                                <input 
                                    type="url" 
                                    value={gasUrl} 
                                    onChange={e => setGasUrl(e.target.value)} 
                                    placeholder="https://script.google.com/macros/s/..." 
                                    className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all shadow-inner"
                                />
                                <button 
                                    onClick={handleSaveGasUrl}
                                    disabled={isSavingUrl || !canManage}
                                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSavingUrl ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <SaveIcon className="w-4 h-4"/>}
                                    Lưu cấu hình
                                </button>
                            </div>
                            <p className="text-[9px] text-gray-400 mt-2 italic">* Cấu hình này dùng chung cho việc gửi Email và đồng bộ Google Sheets.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'billing', label: 'Bảng tính phí', icon: <BanknotesIcon />, color: 'text-blue-600' },
                            { id: 'vas', label: 'Doanh thu GTGT', icon: <SparklesIcon />, color: 'text-amber-600' },
                            { id: 'expenses', label: 'Chi phí QLVH', icon: <TrendingDownIcon />, color: 'text-rose-600' }
                        ].map(mod => (
                            <div key={mod.id} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between shadow-sm group hover:border-emerald-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl bg-gray-50 ${mod.color} group-hover:scale-110 transition-transform`}>
                                        {React.cloneElement(mod.icon as React.ReactElement, { className: 'w-5 h-5' })}
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">{mod.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {renderStatus(moduleStatuses[mod.id])}
                                    <button 
                                        onClick={() => handleGoogleSheetsBackup(mod.id as any)}
                                        disabled={moduleStatuses[mod.id] === 'loading' || !canManage}
                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-90 disabled:opacity-30"
                                        title="Backup Ngay"
                                    >
                                        <CloudArrowUpIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dữ liệu hệ thống */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3 text-rose-600">
                    <TrashIcon className="w-6 h-6" /> Quản lý Dữ liệu Hệ thống
                </h3>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    Các công cụ này dùng để khởi tạo lại hệ thống hoặc dọn dẹp bộ nhớ. Vui lòng cân nhắc kỹ trước khi sử dụng.
                </p>
                <div className="flex flex-wrap gap-4">
                    <button onClick={() => setConfirmAction('delete_data')} disabled={!canManage} className="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 disabled:bg-gray-200 transition-all active:scale-95 flex items-center gap-2">
                        <TrashIcon className="w-4 h-4" /> Xoá sạch Dữ liệu
                    </button>
                    <button onClick={() => setConfirmAction('restore_mock')} disabled={!canManage} className="px-6 py-2.5 bg-slate-600 text-white font-bold rounded-xl shadow-lg shadow-slate-100 hover:bg-slate-700 disabled:bg-gray-200 transition-all active:scale-95 flex items-center gap-2">
                        <CircularArrowRefreshIcon className="w-4 h-4" /> Khôi phục Dữ liệu Mẫu
                    </button>
                </div>
            </div>

            {confirmAction && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-rose-500 p-6 shadow-[0_-4px_30px_rgba(0,0,0,0.2)] animate-slide-up">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0 bg-rose-100 p-4 rounded-2xl"><WarningIcon className="h-8 w-8 text-rose-600" /></div>
                        <div className="flex-grow text-center md:text-left">
                            <h4 className="text-lg font-black text-rose-600 mb-1 uppercase tracking-tight">Xác nhận Thao tác Nguy hiểm</h4>
                            <p className="text-sm text-gray-600 font-medium">{getConfirmMessage()}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <input type="password" value={password} onKeyDown={e => e.key === 'Enter' && handleConfirmAction()} onChange={e => setPassword(e.target.value)} placeholder="Mật khẩu Admin" className="p-3 border border-gray-300 rounded-xl bg-gray-50 w-full sm:w-48 focus:ring-2 focus:ring-rose-500 outline-none font-bold" autoFocus />
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={handleConfirmAction} className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 active:scale-95">Xác nhận</button>
                                <button onClick={() => setConfirmAction(null)} className="flex-1 sm:flex-none px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!canManage && <p className="text-rose-600 text-center font-bold mt-8 uppercase tracking-widest text-xs">Chỉ Admin mới có quyền truy cập chức năng này.</p>}
        </div>
    );
};

export default BackupRestorePage;
