
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ShoppingBagIcon, WrenchIcon, PaletteIcon, FileTextIcon,
    CalendarDaysIcon, PlusIcon, ClockIcon, TrashIcon,
    ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
    TrendingDownIcon, ArchiveBoxIcon, CheckCircleIcon,
    DocumentArrowDownIcon,
    CloudArrowUpIcon
} from '../ui/Icons';
import { formatCurrency, timeAgo } from '../../utils/helpers';
import { useNotification, useAuth, useDataRefresh, useSettings } from '../../App';
import { addExpense, getExpensesByMonth, deleteExpense } from '../../services/expenseService';
import type { OperationalExpense, ExpenseCategory } from '../../types';
import Spinner from '../ui/Spinner';

// Khai báo XLSX từ thư viện CDN trong index.html
declare const XLSX: any;

const formatInputNumber = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) return "";
    return Number(raw).toLocaleString('vi-VN');
};

const parseInputNumber = (val: string) => {
    return parseInt(val.replace(/\D/g, "")) || 0;
};

// --- Sub-Component: Date Picker Popover (Simplified) ---
const DatePickerPopover: React.FC<{
    selectedDate: string;
    onSelect: (date: string) => void;
    onClose: () => void;
}> = ({ selectedDate, onSelect, onClose }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const date = new Date(selectedDate);
    const [viewMonth, setViewMonth] = useState(date.getMonth());
    const [viewYear, setViewYear] = useState(date.getFullYear());

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
        <div ref={popoverRef} className="absolute top-full mt-2 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72 animate-fade-in-down">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => setViewMonth(m => m === 0 ? 11 : m - 1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeftIcon className="w-4 h-4"/></button>
                <div className="text-sm font-black text-gray-800 uppercase tracking-tight">{months[viewMonth]} {viewYear}</div>
                <button onClick={() => setViewMonth(m => m === 11 ? 0 : m + 1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRightIcon className="w-4 h-4"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map(d => <span key={d} className="text-[10px] font-black text-gray-400">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {blanks.map(b => <div key={`b-${b}`} />)}
                {days.map(d => {
                    const fsStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = fsStr === selectedDate;
                    return (
                        <button 
                            key={d} 
                            onClick={() => { onSelect(fsStr); onClose(); }} 
                            className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-orange-600 text-white shadow-md' : 'hover:bg-orange-50 text-gray-600'}`}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const ExpenseManagementPage: React.FC = () => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const { invoiceSettings } = useSettings();
    const { refreshData } = useDataRefresh();
    
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<ExpenseCategory>('purchasing');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Form inputs
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const categoryConfig: Record<ExpenseCategory, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
        purchasing: { label: 'Mua sắm', icon: <ShoppingBagIcon />, color: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
        maintenance: { label: 'Bảo trì', icon: <WrenchIcon />, color: 'bg-orange-600', badge: 'bg-orange-50 text-orange-700 border-orange-100' },
        decoration: { label: 'Trang trí', icon: <PaletteIcon />, color: 'bg-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-100' },
        other: { label: 'Khác', icon: <FileTextIcon />, color: 'bg-gray-600', badge: 'bg-gray-50 text-gray-700 border-gray-100' }
    };

    const fetchExpenses = async (period: string) => {
        setIsLoading(true);
        try {
            const data = await getExpensesByMonth(period.substring(0, 7));
            setExpenses(data);
        } catch {
            showToast('Lỗi tải dữ liệu chi phí.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses(selectedDate);
    }, [selectedDate.substring(0, 7)]);

    const handleAddExpense = async () => {
        const numAmount = parseInputNumber(amount);
        if (numAmount <= 0) {
            showToast('Vui lòng nhập số tiền hợp lệ.', 'warn');
            return;
        }
        if (!description.trim()) {
            showToast('Vui lòng nhập nội dung chi phí.', 'warn');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                category: activeTab,
                amount: numAmount,
                description: description.trim(),
                date: selectedDate,
                performedBy: user?.DisplayName || user?.Email || 'Admin'
            };
            const id = await addExpense(payload);
            const newItem = { ...payload, id, createdAt: new Date().toISOString() };
            
            if (selectedDate.substring(0, 7) === newItem.date.substring(0, 7)) {
                setExpenses(prev => [newItem, ...prev]);
            }
            
            // QUAN TRỌNG: Gọi refreshData để Portal Mobile cập nhật số liệu ngay lập tức
            refreshData(true);
            
            showToast('Ghi nhận chi phí thành công.', 'success');
            setAmount('');
            setDescription('');
        } catch {
            showToast('Lỗi khi lưu chi phí.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSyncToSheets = async (item: OperationalExpense) => {
        if (!invoiceSettings.appsScriptUrl) {
            showToast('Chưa cấu hình Apps Script URL trong Cài đặt.', 'error');
            return;
        }

        setIsSyncing(true);
        try {
            const formData = new URLSearchParams();
            formData.append('action_type', 'SYNC_EXPENSE');
            formData.append('id', item.id);
            formData.append('date', item.date);
            formData.append('category', categoryConfig[item.category].label);
            formData.append('description', item.description);
            formData.append('amount', item.amount.toString());
            formData.append('performedBy', item.performedBy);

            const response = await fetch(invoiceSettings.appsScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            if (response.ok) {
                showToast(`Đã đồng bộ phiếu "${item.description}" sang Google Sheets.`, 'success');
            } else {
                showToast('Lỗi server Apps Script.', 'error');
            }
        } catch (e) {
            showToast('Không thể kết nối Apps Script.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xác nhận xóa khoản chi này?')) return;
        try {
            await deleteExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
            
            // Cập nhật lại số liệu Dashboard
            refreshData(true);
            
            showToast('Đã xóa giao dịch.', 'success');
        } catch {
            showToast('Lỗi khi xóa.', 'error');
        }
    };

    const handleExportExcel = () => {
        if (expenses.length === 0) {
            showToast('Không có dữ liệu chi phí trong tháng này để xuất.', 'info');
            return;
        }

        try {
            const periodLabel = selectedDate.substring(0, 7);
            const dataToExport = expenses.map((exp, idx) => ({
                'STT': idx + 1,
                'Ngày chi': new Date(exp.date).toLocaleDateString('vi-VN'),
                'Hạng mục': categoryConfig[exp.category].label,
                'Nội dung chi tiết': exp.description,
                'Số tiền (VNĐ)': exp.amount,
                'Người thực hiện': exp.performedBy,
                'Ngày ghi sổ': new Date(exp.createdAt).toLocaleString('vi-VN')
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Chi phí vận hành");
            XLSX.writeFile(workbook, `Bao_cao_Chi_phi_Van_hanh_${periodLabel}.xlsx`);
            showToast('Xuất báo cáo Excel thành công!', 'success');
        } catch (error) {
            showToast('Lỗi khi tạo file Excel.', 'error');
        }
    };

    const totalMonthly = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

    return (
        <div className="flex flex-col h-full bg-[#fcfaf8] overflow-hidden">
            {/* Header / Toolbar */}
            <div className="bg-white border-b border-orange-100 p-4 shrink-0 shadow-sm z-10">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-50 p-1 rounded-xl flex items-center border border-orange-100 shadow-inner">
                            <button onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() - 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }} className="p-2 hover:bg-white rounded-lg transition-all text-orange-600"><ChevronLeftIcon className="w-4 h-4"/></button>
                            <div className="relative">
                                <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="px-4 py-2 text-xs font-black uppercase tracking-tight text-gray-800 flex items-center gap-2">
                                    <CalendarDaysIcon className="w-4 h-4 text-orange-600" />
                                    {new Date(selectedDate).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
                                    <ChevronDownIcon className="w-3 h-3 opacity-40" />
                                </button>
                                {isDatePickerOpen && <DatePickerPopover selectedDate={selectedDate} onSelect={setSelectedDate} onClose={() => setIsDatePickerOpen(false)} />}
                            </div>
                            <button onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() + 1);
                                setSelectedDate(d.toISOString().split('T')[0]);
                            }} className="p-2 hover:bg-white rounded-lg transition-all text-orange-600"><ChevronRightIcon className="w-4 h-4"/></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleExportExcel}
                            className="h-10 px-4 flex items-center gap-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-orange-50 hover:border-orange-200 transition-all active:scale-95 shadow-sm"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4 text-gray-400" />
                            Xuất báo cáo tháng
                        </button>

                        <div className="h-10 px-6 bg-orange-600 border border-orange-700 rounded-xl flex items-center gap-3 shadow-lg shadow-orange-200">
                            <TrendingDownIcon className="w-5 h-5 text-white"/>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-orange-100 uppercase leading-none mb-0.5">Tổng chi tháng</span>
                                <span className="text-sm font-black text-white leading-none tabular-nums">- {formatCurrency(totalMonthly)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Split View */}
            <div className="flex-1 overflow-hidden p-6 max-w-7xl mx-auto w-full flex gap-8">
                
                {/* LEFT COLUMN: INPUT STATION */}
                <div className="w-1/3 flex flex-col gap-6 animate-fade-in-down h-full">
                    <div className="bg-white rounded-2xl shadow-xl border-t-4 border-orange-600 flex flex-col h-full overflow-hidden">
                        <div className="grid grid-cols-4 border-b border-gray-50 bg-gray-50/50 p-1">
                            {(Object.keys(categoryConfig) as ExpenseCategory[]).map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => setActiveTab(cat)}
                                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all gap-1 ${
                                        activeTab === cat 
                                            ? `bg-white shadow-md text-gray-900 border border-gray-100` 
                                            : 'text-gray-400 hover:text-orange-600'
                                    }`}
                                >
                                    {React.cloneElement(categoryConfig[cat].icon as React.ReactElement<any>, { 
                                        className: `w-5 h-5 ${activeTab === cat ? 'text-orange-600' : ''}` 
                                    })}
                                    <span className="text-[9px] font-black uppercase tracking-tight">{categoryConfig[cat].label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Ngày chi</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={e => setSelectedDate(e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-orange-200"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Số tiền chi (VNĐ)</label>
                                <input 
                                    type="text" 
                                    value={amount} 
                                    onChange={e => setAmount(formatInputNumber(e.target.value))} 
                                    className="w-full p-3 bg-orange-50 border border-orange-100 rounded-xl outline-none text-lg font-black text-orange-700 focus:bg-white focus:ring-2 focus:ring-orange-200 text-right"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block">Nội dung chi tiết</label>
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all"
                                    placeholder="Nhập lý do chi, đơn vị cung cấp..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-50 bg-gray-50/30">
                            <button 
                                onClick={handleAddExpense}
                                disabled={isSubmitting}
                                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-orange-200 bg-orange-600 text-white hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isSubmitting ? <Spinner /> : <><PlusIcon className="w-5 h-5" /> Ghi nhận chi phí</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: HISTORY */}
                <div className="w-2/3 flex flex-col gap-6 h-full overflow-hidden">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-orange-100 text-orange-600">
                                    <ClockIcon className="w-4 h-4"/>
                                </div>
                                <h3 className="font-black text-gray-800 text-[10px] uppercase tracking-widest">Lịch sử chi phí tháng</h3>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tabular-nums">{expenses.length} giao dịch</span>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="py-20 flex justify-center"><Spinner /></div>
                            ) : expenses.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-4 opacity-60">
                                    <ArchiveBoxIcon className="w-16 h-16"/>
                                    <p className="font-black uppercase tracking-widest text-xs">Chưa có khoản chi nào trong tháng</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-sm">
                                        <tr className="text-left text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                            <th className="px-6 py-3.5 w-24">Ngày</th>
                                            <th className="px-6 py-3.5 w-32">Hạng mục</th>
                                            <th className="px-6 py-3.5">Nội dung</th>
                                            <th className="px-6 py-3.5 text-right w-40">Số tiền</th>
                                            <th className="px-6 py-3.5 w-24 text-center">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {expenses.map(exp => (
                                            <tr key={exp.id} className="group hover:bg-orange-50/30 transition-colors">
                                                <td className="px-6 py-4 font-mono text-[10px] text-gray-500 font-bold">
                                                    {new Date(exp.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border whitespace-nowrap shadow-sm ${categoryConfig[exp.category].badge}`}>
                                                        {categoryConfig[exp.category].label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-xs font-bold text-gray-700 leading-snug line-clamp-1">{exp.description}</p>
                                                    <p className="text-[9px] text-gray-400 font-medium mt-0.5 italic">{exp.performedBy}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-orange-600 tabular-nums">
                                                    - {formatCurrency(exp.amount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center items-center gap-1">
                                                        <button 
                                                            onClick={() => handleSyncToSheets(exp)}
                                                            disabled={isSyncing}
                                                            className="p-1.5 text-gray-300 hover:text-orange-600 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Đồng bộ sang Google Sheets"
                                                        >
                                                            <CloudArrowUpIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(exp.id)} 
                                                            className="p-1.5 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Xóa vĩnh viễn"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseManagementPage;
