
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

const VehicleStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string }> = ({ label, value, icon, color, bgColor }) => (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${bgColor} ${color} flex items-center justify-center shrink-0`}>
            {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight truncate">{label}</p>
            <p className="text-sm font-black text-gray-800 leading-none mt-0.5">{value}</p>
        </div>
    </div>
);

const AdminPortalVehiclesPage: React.FC<AdminPortalVehiclesPageProps> = ({ vehicles = [], units = [], owners = [] }) => {
    const [search, setSearch] = useState('');
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

    // Deep-linking logic: Kiểm tra nếu được dẫn tới từ Search Home
    useEffect(() => {
        const targetId = localStorage.getItem('admin_portal_focus_id');
        if (targetId && targetId.includes('VEH')) { // Giả định VehicleId có chứa tiền tố VEH hoặc định dạng ID Firebase
            setExpandedVehicleId(targetId);
            localStorage.removeItem('admin_portal_focus_id');
        }
    }, []);

    const activeVehicles = useMemo(() => {
        return (vehicles || []).filter(v => v.isActive);
    }, [vehicles]);

    // Thống kê số lượng theo loại
    const stats = useMemo(() => {
        return {
            cars: activeVehicles.filter(v => v.Type === 'car' || v.Type === 'car_a').length,
            motos: activeVehicles.filter(v => v.Type === 'motorbike').length,
            ebikes: activeVehicles.filter(v => v.Type === 'ebike').length,
            bicycles: activeVehicles.filter(v => v.Type === 'bicycle').length,
        };
    }, [activeVehicles]);

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return activeVehicles.filter(v => {
            const unit = (units || []).find(u => u.UnitID === v.UnitID);
            const owner = (owners || []).find(o => o.OwnerID === unit?.OwnerID);
            return v.PlateNumber.toLowerCase().includes(s) || 
                   v.UnitID.toLowerCase().includes(s) || 
                   (owner?.OwnerName || '').toLowerCase().includes(s);
        }).sort((a, b) => a.UnitID.localeCompare(b.UnitID));
    }, [activeVehicles, units, owners, search]);

    const toggleExpand = (id: string) => {
        setExpandedVehicleId(expandedVehicleId === id ? null : id);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 1. Thống kê phương tiện */}
            <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
                <VehicleStatCard label="Ô tô" value={stats.cars} icon={<CarIcon />} color="text-blue-600" bgColor="bg-blue-50" />
                <VehicleStatCard label="Xe máy" value={stats.motos} icon={<MotorbikeIcon />} color="text-orange-600" bgColor="bg-orange-50" />
                <VehicleStatCard label="Xe điện" value={stats.ebikes} icon={<EBikeIcon />} color="text-emerald-600" bgColor="bg-emerald-50" />
                <VehicleStatCard label="Xe đạp" value={stats.bicycles} icon={<BikeIcon />} color="text-purple-600" bgColor="bg-purple-50" />
            </div>

            {/* 2. Thanh tìm kiếm */}
            <div className="px-4 pb-3 bg-slate-50 sticky top-0 z-20">
                <div className="relative group">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Tìm biển số, căn hộ, chủ hộ..." 
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setExpandedVehicleId(null);
                        }}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
                    />
                </div>
            </div>

            {/* 3. Danh sách phương tiện */}
            <div className="divide-y divide-gray-100 pb-24">
                {filtered.map(vehicle => {
                    const isExpanded = expandedVehicleId === vehicle.VehicleId;
                    const unit = (units || []).find(u => u.UnitID === vehicle.UnitID);
                    const owner = (owners || []).find(o => o.OwnerID === unit?.OwnerID);
                    const unitTheme = getPastelColorForName(vehicle.UnitID);

                    return (
                        <div key={vehicle.VehicleId} id={`vehicle-card-${vehicle.VehicleId}`} className={`bg-white transition-all ${isExpanded ? 'ring-1 ring-primary/20 shadow-md my-2' : ''}`}>
                            <div 
                                onClick={() => toggleExpand(vehicle.VehicleId)}
                                className={`p-4 flex items-center justify-between active:bg-gray-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                                        isExpanded ? 'bg-primary text-white scale-110 shadow-lg' : `${unitTheme.bg} ${unitTheme.text} ${unitTheme.border}`
                                    }`}>
                                        {vehicle.UnitID}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-mono font-black text-gray-800 tracking-tight truncate">
                                            {formatLicensePlate(vehicle.PlateNumber)}
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-bold uppercase truncate">
                                            {owner?.OwnerName || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className={`p-2 rounded-lg ${
                                        vehicle.Type.includes('car') ? 'bg-blue-50 text-blue-500' : 
                                        vehicle.Type === 'motorbike' ? 'bg-orange-50 text-orange-500' :
                                        vehicle.Type === 'ebike' ? 'bg-emerald-50 text-emerald-500' : 'bg-purple-50 text-purple-500'
                                    }`}>
                                        {vehicle.Type.includes('car') ? <CarIcon className="w-5 h-5"/> : 
                                         vehicle.Type === 'motorbike' ? <MotorbikeIcon className="w-5 h-5"/> :
                                         vehicle.Type === 'ebike' ? <EBikeIcon className="w-5 h-5"/> : <BikeIcon className="w-5 h-5"/>}
                                    </div>
                                    <div className="text-gray-300">
                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-primary" /> : <ChevronDownIcon className="w-5 h-5" />}
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 animate-fade-in-down border-t border-gray-50 pt-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Loại xe</p>
                                            <p className="text-xs font-black text-gray-700">{translateVehicleType(vehicle.Type)}</p>
                                            <p className="text-[10px] text-gray-400 mt-1 italic leading-tight truncate">{vehicle.VehicleName || 'Không rõ model'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Trạng thái đỗ</p>
                                            <p className={`text-xs font-black ${vehicle.parkingStatus === 'Lốt chính' ? 'text-green-600' : 'text-blue-600'}`}>
                                                {vehicle.parkingStatus || 'Không có lốt'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 active:bg-slate-100 transition-colors">
                                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-primary shadow-sm">
                                            <PhoneArrowUpRightIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Liên hệ chủ hộ</p>
                                            <a href={`tel:${owner?.Phone}`} onClick={(e) => e.stopPropagation()} className="text-sm font-black text-blue-600">{owner?.Phone || '---'}</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 px-1 text-[11px] text-gray-400 font-medium">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                        <span>Ngày đăng ký: {new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <SearchIcon className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-gray-400 text-sm italic">
                        Không tìm thấy phương tiện nào khớp.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AdminPortalVehiclesPage;
