
import React, { useState, useMemo } from 'react';
import type { Unit, Owner, Vehicle, ChargeRaw, ActivityLog } from '../../../types';
import { SearchIcon, CarIcon, UserIcon, PhoneArrowUpRightIcon, HomeIcon, BanknotesIcon, ClockIcon, XMarkIcon } from '../../ui/Icons';
import { formatCurrency, formatLicensePlate, getPastelColorForName } from '../../../utils/helpers';

interface AdminPortalSearchPageProps {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    charges: ChargeRaw[];
    activityLogs: ActivityLog[];
}

const AdminPortalSearchPage: React.FC<AdminPortalSearchPageProps> = ({ units, owners, vehicles, charges }) => {
    const [queryStr, setQueryStr] = useState('');
    const currentPeriod = new Date().toISOString().slice(0, 7);

    const results = useMemo(() => {
        if (queryStr.length < 2) return [];
        const q = queryStr.toLowerCase();

        // 1. Search by Unit ID
        const matchedUnits = units.filter(u => (u.UnitID || '').toLowerCase().includes(q));

        // 2. Search by Owner Name/Phone/Email
        const matchedOwners = owners.filter(o => 
            (o.OwnerName || '').toLowerCase().includes(q) || 
            (o.Phone || '').includes(q) || 
            (o.Email || '').toLowerCase().includes(q)
        );

        // 3. Search by Plate Number
        const matchedVehicles = vehicles.filter(v => 
            v.isActive && (v.PlateNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(q.replace(/[^a-zA-Z0-9]/g, ''))
        );

        // Aggregate unique unit IDs
        const unitIds = new Set<string>();
        matchedUnits.forEach(u => unitIds.add(u.UnitID));
        matchedOwners.forEach(o => {
            const unit = units.find(u => u.OwnerID === o.OwnerID);
            if (unit) unitIds.add(unit.UnitID);
        });
        matchedVehicles.forEach(v => unitIds.add(v.UnitID));

        return Array.from(unitIds).map(id => {
            const unit = units.find(u => u.UnitID === id)!;
            const owner = owners.find(o => o.OwnerID === unit?.OwnerID);
            const unitVehicles = vehicles.filter(v => v.UnitID === id && v.isActive);
            const charge = charges.find(c => c.UnitID === id && c.Period === currentPeriod);
            return { id, unit, owner, vehicles: unitVehicles, charge };
        }).sort((a,b) => a.id.localeCompare(b.id));

    }, [queryStr, units, owners, vehicles, charges, currentPeriod]);

    return (
        <div className="p-4 space-y-4">
            <div className="sticky top-0 bg-slate-50 pt-2 pb-4 z-20">
                <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Tìm Căn hộ, Biển số, Tên, SĐT..." 
                        value={queryStr}
                        onChange={(e) => setQueryStr(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary outline-none text-lg font-medium"
                    />
                    {queryStr && (
                        <button onClick={() => setQueryStr('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {queryStr.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2 ml-2 font-bold uppercase tracking-widest">
                        Tìm thấy {results.length} kết quả
                    </p>
                )}
            </div>

            <div className="space-y-4">
                {results.length === 0 && queryStr.length >= 2 && (
                    <div className="bg-white p-8 rounded-2xl text-center border border-dashed">
                        <p className="text-gray-400">Không tìm thấy thông tin phù hợp.</p>
                    </div>
                )}

                {results.map(res => {
                    const theme = getPastelColorForName(res.owner?.OwnerName || res.id);
                    const isPaid = res.charge && ['paid', 'paid_tm', 'paid_ck'].includes(res.charge.paymentStatus);

                    return (
                        <div key={res.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-down">
                            <div className={`p-4 ${theme.bg} flex justify-between items-center border-b`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm font-black text-base border-2 ${theme.bg} ${theme.text} ${theme.border} bg-white`}>
                                        {res.id}
                                    </div>
                                    <div>
                                        <h4 className={`font-black ${theme.text}`}>{res.owner?.OwnerName || 'N/A'}</h4>
                                        <p className="text-xs text-gray-500 font-bold uppercase">{res.unit?.Status || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <a href={`tel:${res.owner?.Phone}`} className="p-2 bg-white rounded-full shadow-sm text-primary inline-block">
                                        <PhoneArrowUpRightIcon className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Billing Quick Status */}
                                <div className={`p-3 rounded-xl flex items-center justify-between ${isPaid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} border`}>
                                    <div className="flex items-center gap-2">
                                        <BanknotesIcon className={`w-4 h-4 ${isPaid ? 'text-green-600' : 'text-red-600'}`} />
                                        <span className="text-xs font-bold uppercase">Cước T{currentPeriod.split('-')[1]}</span>
                                    </div>
                                    <span className={`text-sm font-black ${isPaid ? 'text-green-700' : 'text-red-700'}`}>
                                        {res.charge ? formatCurrency(res.charge.TotalDue) : '---'} 
                                        {isPaid ? ' (Đã thu)' : ' (Nợ)'}
                                    </span>
                                </div>

                                {/* Vehicles */}
                                {res.vehicles.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                            <CarIcon className="w-3 h-3"/> Phương tiện ({res.vehicles.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {res.vehicles.map(v => (
                                                <div key={v.VehicleId} className="bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-gray-800">{formatLicensePlate(v.PlateNumber)}</span>
                                                    <span className="text-[10px] bg-white px-1.5 rounded border text-gray-500">{(v.Type || '').includes('car') ? 'Ô tô' : 'Xe máy'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex gap-2">
                                    <button className="flex-1 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg border hover:bg-gray-100">XEM CHI TIẾT</button>
                                    <button className="flex-1 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20 hover:bg-primary/20">LỊCH SỬ PHÍ</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {queryStr.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <SearchIcon className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-center text-sm px-10">Nhập mã căn, biển số xe hoặc tên để tra cứu nhanh thông tin.</p>
                </div>
            )}
        </div>
    );
};

export default AdminPortalSearchPage;
