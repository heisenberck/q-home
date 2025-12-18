
import React, { useMemo, useState, useEffect } from 'react';
import type { Vehicle, Unit, Owner } from '../../../types';
import { 
    SearchIcon, CarIcon, MotorbikeIcon, ChevronDownIcon, ChevronUpIcon,
    UserIcon, PhoneArrowUpRightIcon, ClockIcon, ShieldCheckIcon,
    EBikeIcon, BikeIcon
} from '../../ui/Icons';
import { formatLicensePlate, getPastelColorForName, translateVehicleType } from '../../../utils/helpers';

interface AdminPortalVehiclesPageProps {
    vehicles?: Vehicle[];
    units?: Unit[];
    owners?: Owner[];
}

const VehicleStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string; isActive: boolean; onClick: () => void }> = ({ label, value, icon, color, bgColor, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`p-3 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex items-center gap-3 ${
            isActive ? `${bgColor} ${color} border-current ring-2 ring-current ring-offset-2` : 'bg-white border-gray-100'
        }`}
    >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : bgColor}`}>
            {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${isActive ? 'text-white' : color}` })}
        </div>
        <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-black leading-none mt-0.5 ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</p>
        </div>
    </div>
);

const AdminPortalVehiclesPage: React.FC<AdminPortalVehiclesPageProps> = ({ vehicles = [], units = [], owners = [] }) => {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

    // Deep-linking logic
    useEffect(() => {
        const targetId = localStorage.getItem('admin_portal_focus_id');
        if (targetId && (targetId.includes('VEH') || targetId.length >= 3)) {
            setExpandedVehicleId(targetId);
            localStorage.removeItem('admin_portal_focus_id');
            
            setTimeout(() => {
                const element = document.getElementById(`vehicle-card-${targetId}`);
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, []);

    const activeVehicles = useMemo(() => (vehicles || []).filter(v => v.isActive), [vehicles]);

    const stats = useMemo(() => ({
        cars: activeVehicles.filter(v => v.Type.includes('car')).length,
        motos: activeVehicles.filter(v => v.Type === 'motorbike').length,
        ebikes: activeVehicles.filter(v => v.Type === 'ebike').length,
        bicycles: activeVehicles.filter(v => v.Type === 'bicycle').length,
    }), [activeVehicles]);

    const filtered = useMemo(() => {
        let result = [...activeVehicles];
        
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(v => {
                const unit = (units || []).find(u => u.UnitID === v.UnitID);
                const owner = (owners || []).find(o => o.OwnerID === unit?.OwnerID);
                return v.PlateNumber.toLowerCase().includes(s) || v.UnitID.toLowerCase().includes(s) || (owner?.OwnerName || '').toLowerCase().includes(s);
            });
        }

        if (typeFilter) {
            if (typeFilter === 'car') result = result.filter(v => v.Type.includes('car'));
            else result = result.filter(v => v.Type === typeFilter);
        }

        return result.sort((a, b) => a.UnitID.localeCompare(b.UnitID));
    }, [activeVehicles, units, owners, search, typeFilter]);

    const toggleTypeFilter = (type: string) => {
        setTypeFilter(typeFilter === type ? null : type);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
                <VehicleStatCard label="Ô tô" value={stats.cars} icon={<CarIcon />} color="text-blue-600" bgColor="bg-blue-50" isActive={typeFilter === 'car'} onClick={() => toggleTypeFilter('car')} />
                <VehicleStatCard label="Xe máy" value={stats.motos} icon={<MotorbikeIcon />} color="text-orange-600" bgColor="bg-orange-50" isActive={typeFilter === 'motorbike'} onClick={() => toggleTypeFilter('motorbike')} />
                <VehicleStatCard label="Xe điện" value={stats.ebikes} icon={<EBikeIcon />} color="text-emerald-600" bgColor="bg-emerald-50" isActive={typeFilter === 'ebike'} onClick={() => toggleTypeFilter('ebike')} />
                <VehicleStatCard label="Xe đạp" value={stats.bicycles} icon={<BikeIcon />} color="text-purple-600" bgColor="bg-purple-50" isActive={typeFilter === 'bicycle'} onClick={() => toggleTypeFilter('bicycle')} />
            </div>

            <div className="px-4 pb-3 sticky top-0 z-20">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm biển số, căn hộ..." 
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setExpandedVehicleId(null); }}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm transition-all font-bold"
                    />
                </div>
            </div>

            <div className="divide-y divide-gray-100 pb-24">
                {filtered.map(vehicle => {
                    const isExpanded = expandedVehicleId === vehicle.VehicleId || expandedVehicleId === vehicle.PlateNumber;
                    const unit = (units || []).find(u => u.UnitID === vehicle.UnitID);
                    const owner = (owners || []).find(o => o.OwnerID === unit?.OwnerID);
                    const unitTheme = getPastelColorForName(vehicle.UnitID);

                    return (
                        <div key={vehicle.VehicleId} id={`vehicle-card-${vehicle.VehicleId}`} className={`bg-white transition-all ${isExpanded ? 'ring-2 ring-primary shadow-md my-2' : ''}`}>
                            <div 
                                onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.VehicleId)}
                                className={`p-4 flex items-center justify-between active:bg-gray-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                                        isExpanded ? 'bg-primary text-white scale-110' : `${unitTheme.bg} ${unitTheme.text} ${unitTheme.border}`
                                    }`}>
                                        {vehicle.UnitID}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-mono font-black text-gray-800 tracking-tight">{formatLicensePlate(vehicle.PlateNumber)}</h4>
                                        <p className="text-[11px] text-gray-400 font-bold uppercase truncate">{owner?.OwnerName || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="text-gray-300">
                                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-primary" /> : <ChevronDownIcon className="w-5 h-5" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 animate-fade-in-down border-t border-gray-100 pt-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Loại xe</p>
                                            <p className="text-xs font-black text-gray-700">{translateVehicleType(vehicle.Type)}</p>
                                            <p className="text-[10px] text-gray-400 mt-1 italic">{vehicle.VehicleName || 'Model chưa rõ'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Đỗ xe</p>
                                            <p className={`text-xs font-black ${vehicle.parkingStatus === 'Lốt chính' ? 'text-green-600' : 'text-blue-600'}`}>{vehicle.parkingStatus || 'Không lốt'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm"><PhoneArrowUpRightIcon className="w-4 h-4" /></div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-gray-400 uppercase">Liên hệ chủ hộ</p>
                                            <a href={`tel:${owner?.Phone}`} className="text-sm font-black text-blue-600">{owner?.Phone || '---'}</a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminPortalVehiclesPage;
