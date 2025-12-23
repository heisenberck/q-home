
import React, { useMemo, useState } from 'react';
import type { OperationalExpense, ExpenseCategory } from '../../../types';
import { 
    ShoppingBagIcon, WrenchIcon, PaletteIcon, FileTextIcon,
    ChevronRightIcon, ClockIcon, UserIcon, TrendingDownIcon,
    BanknotesIcon, InfoIcon
} from '../../ui/Icons';
import { formatCurrency } from '../../../utils/helpers';
import BottomSheet from '../../ui/BottomSheet';

interface AdminPortalExpensesPageProps {
    expenses: OperationalExpense[];
}

const catConfig: Record<ExpenseCategory, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    purchasing: { label: 'Mua sắm', icon: <ShoppingBagIcon size={18} />, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    maintenance: { label: 'Bảo trì', icon: <WrenchIcon size={18} />, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    decoration: { label: 'Trang trí', icon: <PaletteIcon size={18} />, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    other: { label: 'Chi khác', icon: <FileTextIcon size={18} />, color: 'text-rose-600', bgColor: 'bg-rose-50' }
};

export default function AdminPortalExpensesPage({ expenses = [] }: AdminPortalExpensesPageProps) {
    const [selectedItem, setSelectedItem] = useState<OperationalExpense | null>(null);

    // Tính toán số liệu tổng hợp theo hạng mục
    const stats = useMemo(() => {
        const totals = {
            purchasing: 0,
            maintenance: 0,
            decoration: 0,
            other: 0,
            GRAND_TOTAL: 0
        };

        expenses.forEach(e => {
            if (totals[e.category] !== undefined) {
                totals[e.category] += e.amount;
            }
            totals.GRAND_TOTAL += e.amount;
        });

        return totals;
    }, [expenses]);

    const sortedList = useMemo(() => {
        return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [expenses]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 1. Top Stat Cards (2x2 Grid) */}
            <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
                {(Object.keys(catConfig) as ExpenseCategory[]).map(cat => (
                    <div key={cat} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-xl ${catConfig[cat].bgColor} ${catConfig[cat].color}`}>
                                {catConfig[cat].icon}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{catConfig[cat].label}</span>
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-800 tabular-nums">
                                {formatCurrency(stats[cat])}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Grand Total Banner */}
            <div className="px-4 pb-4">
                <div className="bg-gradient-to-br from-rose-600 to-orange-600 p-5 rounded-[2rem] shadow-lg shadow-rose-200 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingDownIcon size={80} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Tổng chi phí vận hành</p>
                        <h2 className="text-2xl font-black text-white tabular-nums tracking-tight">
                            {formatCurrency(stats.GRAND_TOTAL)}
                        </h2>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30 text-white">
                        <BanknotesIcon size={24} />
                    </div>
                </div>
            </div>

            {/* 3. Detailed Explanation List */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] mt-2">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <InfoIcon size={18} className="text-rose-600" /> Diễn giải khoản chi
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 bg-slate-50 px-2 py-1 rounded-lg border border-gray-100 uppercase">
                            {expenses.length} phiếu chi
                        </span>
                    </div>

                    <div className="space-y-4 pb-24">
                        {sortedList.length === 0 ? (
                            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                                <TrendingDownIcon size={48} />
                                <p className="font-black uppercase tracking-widest text-xs">Chưa ghi nhận khoản chi nào</p>
                            </div>
                        ) : (
                            sortedList.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => setSelectedItem(item)}
                                    className="group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all hover:border-rose-200"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl ${catConfig[item.category].bgColor} ${catConfig[item.category].color} flex items-center justify-center shrink-0 shadow-inner`}>
                                            {catConfig[item.category].icon}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{item.description}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{catConfig[item.category].label}</span>
                                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                <span className="text-[10px] text-gray-400 font-bold">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        <span className="font-black text-rose-600 text-sm whitespace-nowrap tabular-nums">
                                            -{formatCurrency(item.amount)}
                                        </span>
                                        <ChevronRightIcon size={16} className="text-gray-200 group-hover:text-rose-500 transition-colors" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Sheet */}
            <BottomSheet 
                isOpen={!!selectedItem} 
                onClose={() => setSelectedItem(null)} 
                title="Chi tiết phiếu chi"
            >
                {selectedItem && (
                    <div className="space-y-6">
                        <div className="text-center py-8 bg-rose-50 rounded-[2.5rem] border border-rose-100">
                            <p className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest mb-1">Số tiền thanh toán</p>
                            <h2 className="text-4xl font-black text-rose-700 tabular-nums tracking-tighter">
                                -{formatCurrency(selectedItem.amount)}
                            </h2>
                            <div className="flex justify-center mt-3">
                                <span className="px-4 py-1 bg-white/60 rounded-full text-[10px] font-black uppercase tracking-widest text-rose-800 border border-rose-200 shadow-sm">
                                    {catConfig[selectedItem.category].label}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                <div className="p-2.5 bg-white rounded-xl text-rose-600 shadow-sm border border-rose-50"><FileTextIcon size={20}/></div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nội dung chi</p>
                                    <p className="text-sm font-bold text-gray-800 leading-relaxed">{selectedItem.description}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-rose-600">
                                        <ClockIcon size={16} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Ngày chi</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800">{new Date(selectedItem.date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-rose-600">
                                        <UserIcon size={16} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Người thực hiện</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 truncate">{selectedItem.performedBy}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="pb-4 text-center">
                            <p className="text-[10px] text-gray-400 italic uppercase tracking-widest">Hóa đơn đã được xác thực bởi kế toán</p>
                        </div>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}
