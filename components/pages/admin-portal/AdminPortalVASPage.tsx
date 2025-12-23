
import React, { useMemo, useState } from 'react';
import type { MiscRevenue, MiscRevenueType } from '../../../types';
import { 
    CarIcon, StoreIcon, ZapIcon, SparklesIcon,
    ChevronRightIcon, ClockIcon, UserIcon, InfoIcon,
    BanknotesIcon, TrendingUpIcon
} from '../../ui/Icons';
import { formatCurrency } from '../../../utils/helpers';
import BottomSheet from '../../ui/BottomSheet';

interface AdminPortalVASPageProps {
    miscRevenues: MiscRevenue[];
}

const typeConfig: Record<MiscRevenueType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = { 
    PARKING: { label: 'Xe lượt', icon: <CarIcon size={18} />, color: 'text-blue-600', bgColor: 'bg-blue-50' }, 
    KIOS: { label: 'Kios', icon: <StoreIcon size={18} />, color: 'text-amber-600', bgColor: 'bg-amber-50' }, 
    VAT_SERVICE: { label: 'Dịch vụ GTGT', icon: <ZapIcon size={18} />, color: 'text-purple-600', bgColor: 'bg-purple-50' }, 
    OTHER: { label: 'Thu khác', icon: <SparklesIcon size={18} />, color: 'text-slate-600', bgColor: 'bg-slate-50' } 
};

export default function AdminPortalVASPage({ miscRevenues = [] }: AdminPortalVASPageProps) {
    const [selectedItem, setSelectedItem] = useState<MiscRevenue | null>(null);

    // Tính toán số liệu tổng hợp
    const stats = useMemo(() => {
        const totals = {
            PARKING: 0,
            KIOS: 0,
            VAT_SERVICE: 0,
            OTHER: 0,
            GRAND_TOTAL: 0
        };

        miscRevenues.forEach(r => {
            if (totals[r.type] !== undefined) {
                totals[r.type] += r.amount;
            }
            totals.GRAND_TOTAL += r.amount;
        });

        return totals;
    }, [miscRevenues]);

    const sortedList = useMemo(() => {
        return [...miscRevenues].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [miscRevenues]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 1. Top Stat Cards (2x2 Grid) */}
            <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
                {(Object.keys(typeConfig) as MiscRevenueType[]).map(type => (
                    <div key={type} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-xl ${typeConfig[type].bgColor} ${typeConfig[type].color}`}>
                                {typeConfig[type].icon}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{typeConfig[type].label}</span>
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-800 tabular-nums">
                                {formatCurrency(stats[type])}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Grand Total Banner */}
            <div className="px-4 pb-4">
                <div className="bg-gradient-to-br from-primary to-emerald-700 p-5 rounded-[2rem] shadow-lg shadow-primary/20 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BanknotesIcon size={80} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Tổng doanh thu GTGT</p>
                        <h2 className="text-2xl font-black text-white tabular-nums tracking-tight">
                            {formatCurrency(stats.GRAND_TOTAL)}
                        </h2>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30 text-white">
                        <TrendingUpIcon size={24} />
                    </div>
                </div>
            </div>

            {/* 3. Detailed Explanation List */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] mt-2">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <InfoIcon size={18} className="text-primary" /> Diễn giải nguồn thu
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 bg-slate-50 px-2 py-1 rounded-lg border border-gray-100 uppercase">
                            {miscRevenues.length} mục
                        </span>
                    </div>

                    <div className="space-y-4 pb-24">
                        {sortedList.length === 0 ? (
                            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                                <BanknotesIcon size={48} />
                                <p className="font-black uppercase tracking-widest text-xs">Chưa có dữ liệu nguồn thu</p>
                            </div>
                        ) : (
                            sortedList.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => setSelectedItem(item)}
                                    className="group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all hover:border-primary/20"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl ${typeConfig[item.type].bgColor} ${typeConfig[item.type].color} flex items-center justify-center shrink-0 shadow-inner`}>
                                            {typeConfig[item.type].icon}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{item.description}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{typeConfig[item.type].label}</span>
                                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                <span className="text-[10px] text-gray-400 font-bold">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        <span className="font-black text-emerald-600 text-sm whitespace-nowrap tabular-nums">
                                            +{formatCurrency(item.amount)}
                                        </span>
                                        <ChevronRightIcon size={16} className="text-gray-200 group-hover:text-primary transition-colors" />
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
                title="Chi tiết giao dịch"
            >
                {selectedItem && (
                    <div className="space-y-6">
                        <div className="text-center py-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Số tiền ghi sổ</p>
                            <h2 className="text-4xl font-black text-emerald-700 tabular-nums tracking-tighter">
                                +{formatCurrency(selectedItem.amount)}
                            </h2>
                            <div className="flex justify-center mt-3">
                                <span className="px-4 py-1 bg-white/60 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-800 border border-emerald-200 shadow-sm">
                                    {typeConfig[selectedItem.type].label}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                <div className="p-2.5 bg-white rounded-xl text-blue-600 shadow-sm border border-blue-50"><InfoIcon size={20}/></div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nội dung chi tiết</p>
                                    <p className="text-sm font-bold text-gray-800 leading-relaxed">{selectedItem.description}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-primary">
                                        <ClockIcon size={16} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Ngày thu</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800">{new Date(selectedItem.date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-primary">
                                        <UserIcon size={16} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Người tạo</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 truncate">{selectedItem.createdBy.split('@')[0]}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="pb-4 text-center">
                            <p className="text-[10px] text-gray-400 italic">Dữ liệu được trích xuất từ hệ thống quản lý tài chính</p>
                        </div>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}
