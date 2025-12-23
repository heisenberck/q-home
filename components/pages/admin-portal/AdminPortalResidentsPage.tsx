
import React, { useMemo, useState } from 'react';
import type { Unit, Owner, Vehicle, ActivityLog } from '../../../types';
import { 
    UserIcon, SearchIcon, PhoneIcon, 
    ChevronRightIcon, EnvelopeIcon, CarIcon,
    MotorbikeIcon, KeyIcon, StoreIcon, EBikeIcon, BikeIcon,
    ClockIcon, ShieldCheckIcon, MegaphoneIcon, PencilSquareIcon
} from '../../ui/Icons';
import { parseUnitCode, translateVehicleType, getPastelColorForName, timeAgo } from '../../../utils/helpers';
import BottomSheet from '../../ui/BottomSheet';

interface AdminPortalResidentsPageProps {
    units?: Unit[];
    owners?: Owner[];
    vehicles?: Vehicle[];
    activityLogs?: ActivityLog[];
}

const getStatusVN = (status: string) => {
    switch (status) {
        case 'Owner': return 'Chính chủ';
        case 'Rent': return 'Hộ thuê';
        case 'Business': return 'Kinh doanh';
        default: return status;
    }
};

const getVehicleIcon = (type: string) => {
    if (type === 'car' || type === 'car_a') return <CarIcon className="w-4 h-4 text-blue-500" />;
    if (type === 'motorbike') return <MotorbikeIcon className="w-4 h-4 text-orange-500" />;
    if (type === 'ebike') return <EBikeIcon className="w-4 h-4 text-emerald-500" />;
    if (type === 'bicycle') return <BikeIcon className="w-4 h-4 text-purple-500" />;
    return <CarIcon className="w-4 h-4 text-blue-500" />;
};

const ResidentStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string; isActive: boolean; onClick: () => void }> = ({ label, value, icon, color, bgColor, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`p-3 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 ${
            isActive ? `${bgColor} ${color} border-current ring-2 ring-current ring-offset-2` : 'bg-white border-gray-100 text-gray-400'
        }`}
    >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : bgColor}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: `w-5 h-5 ${isActive ? 'text-white' : color}` })}
        </div>
        <div className="text-center">
            <p className={`text-[9px] font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-black leading-none mt-0.5 ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</p>
        </div>
    </div>
);

const AdminPortalResidentsPage: React.FC<AdminPortalResidentsPageProps> = ({ units = [], owners = [], vehicles = [], activityLogs = [] }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    const stats = useMemo(() => ({
        owner: (units || []).filter(u => u.Status === 'Owner').length,
        rent: (units || []).filter(u => u.Status === 'Rent').length,
        business: (units || []).filter(u => u.Status === 'Business').length,
    }), [units]);

    const filtered = useMemo(() => {
        let result = [...(units || [])];
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(u => {
                const owner = (owners || []).find(o => o.OwnerID === u.OwnerID);
                return u.UnitID.toLowerCase().includes(s) || (owner?.OwnerName || '').toLowerCase().includes(s);
            });
        }
        if (statusFilter) result = result.filter(u => u.Status === statusFilter);
        return result.sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 0, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 0, apt: 0 };
            return pa.floor !== pb.floor ? pa.floor - pb.floor : pa.apt - pb.apt;
        });
    }, [units, owners, search, statusFilter]);

    const selectedResidentDetails = useMemo(() => {
        if (!selectedUnit) return null;
        const owner = owners.find(o => o.OwnerID === selectedUnit.OwnerID);
        const unitVehicles = vehicles.filter(v => v.UnitID === selectedUnit.UnitID && v.isActive);
        const logs = activityLogs.filter(l => l.ids?.includes(selectedUnit.UnitID)).slice(0, 3);
        return { owner, unitVehicles, logs };
    }, [selectedUnit, owners, vehicles, activityLogs]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Stats Header */}
            <div className="p-4 grid grid-cols-3 gap-2 shrink-0">
                <ResidentStatCard label="Chính chủ" value={stats.owner} icon={<UserIcon />} color="text-emerald-600" bgColor="bg-emerald-50" isActive={statusFilter === 'Owner'} onClick={() => setStatusFilter(statusFilter === 'Owner' ? null : 'Owner')} />
                <ResidentStatCard label="Hộ thuê" value={stats.rent} icon={<KeyIcon />} color="text-blue-600" bgColor="bg-blue-50" isActive={statusFilter === 'Rent'} onClick={() => setStatusFilter(statusFilter === 'Rent' ? null : 'Rent')} />
                <ResidentStatCard label="Kinh doanh" value={stats.business} icon={<StoreIcon />} color="text-amber-600" bgColor="bg-amber-50" isActive={statusFilter === 'Business'} onClick={() => setStatusFilter(statusFilter === 'Business' ? null : 'Business')} />
            </div>

            {/* Search Input */}
            <div className="px-4 pb-3 sticky top-0 z-20">
                <div className="relative group">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-primary" />
                    <input 
                        type="text" 
                        placeholder="Tìm cư dân, mã căn hộ..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 outline-none text-sm font-bold transition-all"
                    />
                </div>
            </div>

            {/* Cleaner List View */}
            <div className="divide-y divide-gray-50 pb-24 px-4 space-y-2">
                {filtered.map(unit => {
                    const owner = owners.find(o => o.OwnerID === unit.OwnerID);
                    const theme = getPastelColorForName(unit.UnitID);

                    return (
                        <div 
                            key={unit.UnitID} 
                            onClick={() => setSelectedUnit(unit)}
                            className="bg-white p-3 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all group"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${theme.bg} ${theme.text} ${theme.border} group-active:scale-110 transition-transform`}>
                                    {unit.UnitID}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black text-gray-800 truncate">{owner?.OwnerName || 'Chưa cập nhật'}</h4>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{getStatusVN(unit.Status)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Refined Quick Action Call Button */}
                                <a 
                                    href={`tel:${owner?.Phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm active:bg-emerald-100 active:scale-90 transition-all"
                                >
                                    <PhoneIcon className="w-5 h-5" />
                                </a>
                                <ChevronRightIcon className="w-5 h-5 text-gray-200" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail Bottom Sheet */}
            <BottomSheet 
                isOpen={!!selectedUnit} 
                onClose={() => setSelectedUnit(null)} 
                title={`Căn hộ ${selectedUnit?.UnitID}`}
            >
                {selectedResidentDetails && (
                    <div className="space-y-6">
                        {/* Owner Header */}
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-primary">
                                <UserIcon className="w-8 h-8" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chủ hộ</p>
                                <h4 className="text-lg font-black text-gray-800 truncate">{selectedResidentDetails.owner?.OwnerName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-md">
                                        {getStatusVN(selectedUnit!.Status)}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">{selectedUnit!.Area_m2}m²</span>
                                </div>
                            </div>
                        </div>

                        {/* Contact Quick Info */}
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm"><PhoneIcon className="w-5 h-5"/></div>
                                <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase">Số điện thoại</p><p className="text-sm font-black text-gray-800">{selectedResidentDetails.owner?.Phone || '---'}</p></div>
                                <a href={`tel:${selectedResidentDetails.owner?.Phone}`} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md">GỌI</a>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="p-2 bg-white rounded-xl text-purple-600 shadow-sm"><EnvelopeIcon className="w-5 h-5"/></div>
                                <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase">Email</p><p className="text-sm font-black text-gray-800 truncate">{selectedResidentDetails.owner?.Email || '---'}</p></div>
                            </div>
                        </div>

                        {/* Vehicles List */}
                        <div className="space-y-3">
                            <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Phương tiện ({selectedResidentDetails.unitVehicles.length})</h5>
                            <div className="grid grid-cols-1 gap-2">
                                {selectedResidentDetails.unitVehicles.map(v => (
                                    <div key={v.VehicleId} className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                                                {getVehicleIcon(v.Type)}
                                            </div>
                                            <div>
                                                <p className="font-mono text-sm font-black text-gray-800 tracking-tighter">{v.PlateNumber}</p>
                                                <p className="text-[10px] font-bold text-gray-400">{translateVehicleType(v.Type)}</p>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-1 rounded-md uppercase">
                                            {v.parkingStatus || 'Không lốt'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent History */}
                        <div className="space-y-3">
                            <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Hoạt động gần đây</h5>
                            <div className="space-y-3 px-1 border-l-2 border-gray-100 ml-2 py-1">
                                {selectedResidentDetails.logs.map(log => (
                                    <div key={log.id} className="relative pl-6">
                                        <div className="absolute -left-[10px] top-1 w-4 h-4 bg-white border-2 border-primary rounded-full" />
                                        <p className="text-xs font-bold text-gray-700 leading-snug">{log.summary}</p>
                                        <p className="text-[9px] font-black text-gray-400 uppercase mt-1">{timeAgo(log.ts)}</p>
                                    </div>
                                ))}
                                {selectedResidentDetails.logs.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">Chưa có lịch sử thay đổi.</p>
                                )}
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                            <button className="py-4 bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                <MegaphoneIcon className="w-4 h-4" /> Gửi TB
                            </button>
                            <button className="py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg flex items-center justify-center gap-2">
                                <PencilSquareIcon className="w-4 h-4" /> Chỉnh sửa
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
};

export default AdminPortalResidentsPage;
