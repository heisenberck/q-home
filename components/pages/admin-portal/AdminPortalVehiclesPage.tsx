
import React, { useMemo, useState } from 'react';
import type { Vehicle, Unit, Owner } from '../../../types';
import { 
    SearchIcon, CarIcon, MotorbikeIcon, ChevronRightIcon,
    UserIcon, PhoneArrowUpRightIcon, ClockIcon, ShieldCheckIcon,
    EBikeIcon, BikeIcon, Camera, XMarkIcon, ChevronUpIcon, ChevronDownIcon,
    HomeIcon, PencilSquareIcon, TrashIcon
} from '../../ui/Icons';
import { formatLicensePlate, getPastelColorForName, translateVehicleType } from '../../../utils/helpers';
import BottomSheet from '../../ui/BottomSheet';

interface AdminPortalVehiclesPageProps {
    vehicles?: Vehicle[];
    units?: Unit[];
    owners?: Owner[];
}

const getVehicleIcon = (type: string) => {
    if (type === 'car' || type === 'car_a') return <CarIcon className="w-full h-full" />;
    if (type === 'motorbike') return <MotorbikeIcon className="w-full h-full" />;
    if (type === 'ebike') return <EBikeIcon className="w-full h-full" />;
    if (type === 'bicycle') return <BikeIcon className="w-full h-full" />;
    return <CarIcon className="w-full h-full" />;
};

const VehicleStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string; isActive: boolean; onClick: () => void }> = ({ label, value, icon, color, bgColor, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`p-3 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex items-center gap-3 ${
            isActive ? `${bgColor} ${color} border-current ring-2 ring-current ring-offset-2` : 'bg-white border-gray-100'
        }`}
    >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : bgColor}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: `w-5 h-5 ${isActive ? 'text-white' : color}` })}
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
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    const selectedVehicleDetails = useMemo(() => {
        if (!selectedVehicle) return null;
        const unit = units.find(u => u.UnitID === selectedVehicle.UnitID);
        const owner = owners.find(o => o.OwnerID === unit?.OwnerID);
        return { unit, owner };
    }, [selectedVehicle, units, owners]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Stats Header */}
            <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
                <VehicleStatCard label="Ô tô" value={stats.cars} icon={<CarIcon />} color="text-blue-600" bgColor="bg-blue-50" isActive={typeFilter === 'car'} onClick={() => setTypeFilter(typeFilter === 'car' ? null : 'car')} />
                <VehicleStatCard label="Xe máy" value={stats.motos} icon={<MotorbikeIcon />} color="text-orange-600" bgColor="bg-orange-50" isActive={typeFilter === 'motorbike'} onClick={() => setTypeFilter(typeFilter === 'motorbike' ? null : 'motorbike')} />
                <VehicleStatCard label="Xe điện" value={stats.ebikes} icon={<EBikeIcon />} color="text-emerald-600" bgColor="bg-emerald-50" isActive={typeFilter === 'ebike'} onClick={() => setTypeFilter(typeFilter === 'ebike' ? null : 'ebike')} />
                <VehicleStatCard label="Xe đạp" value={stats.bicycles} icon={<BikeIcon />} color="text-purple-600" bgColor="bg-purple-50" isActive={typeFilter === 'bicycle'} onClick={() => setTypeFilter(typeFilter === 'bicycle' ? null : 'bicycle')} />
            </div>

            {/* Search Input */}
            <div className="px-4 pb-3 sticky top-0 z-20">
                <div className="relative group">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm biển số, mã căn..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 outline-none text-sm font-bold transition-all"
                    />
                </div>
            </div>

            {/* List View */}
            <div className="divide-y divide-gray-50 pb-24 px-4 space-y-2">
                {filtered.map(vehicle => {
                    const theme = getPastelColorForName(vehicle.UnitID);
                    return (
                        <div 
                            key={vehicle.VehicleId} 
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="bg-white p-3 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all group"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center p-2 shrink-0 ${theme.bg} ${theme.text} ${theme.border} group-active:scale-110 transition-transform`}>
                                    {getVehicleIcon(vehicle.Type)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-mono font-black text-gray-800 tracking-tighter uppercase">{formatLicensePlate(vehicle.PlateNumber)}</h4>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Căn {vehicle.UnitID}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {vehicle.parkingStatus === 'Lốt chính' && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-md border border-emerald-100">Lốt chính</span>
                                )}
                                <ChevronRightIcon className="w-5 h-5 text-gray-100" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Vehicle Detail Bottom Sheet */}
            <BottomSheet 
                isOpen={!!selectedVehicle} 
                onClose={() => setSelectedVehicle(null)} 
                title="Thông tin phương tiện"
            >
                {selectedVehicle && selectedVehicleDetails && (
                    <div className="space-y-6">
                        {/* Plate & Type Header */}
                        <div className="text-center py-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm text-primary mx-auto mb-3">
                                <div className="w-10 h-10">{getVehicleIcon(selectedVehicle.Type)}</div>
                            </div>
                            <h2 className="text-3xl font-mono font-black text-gray-900 tracking-tighter uppercase">
                                {formatLicensePlate(selectedVehicle.PlateNumber)}
                            </h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                                {translateVehicleType(selectedVehicle.Type as any)} • {selectedVehicle.VehicleName || 'Chưa rõ Model'}
                            </p>
                        </div>

                        {/* Owner Info */}
                        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                    <HomeIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Gán cho căn hộ</p>
                                    <h4 className="text-base font-black text-gray-800">{selectedVehicle.UnitID}</h4>
                                </div>
                            </div>
                            <div className="h-px bg-gray-50"></div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                        <UserIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Chủ xe</p>
                                        <h4 className="text-base font-black text-gray-800">{selectedVehicleDetails.owner?.OwnerName}</h4>
                                    </div>
                                </div>
                                <a href={`tel:${selectedVehicleDetails.owner?.Phone}`} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all">
                                    <PhoneArrowUpRightIcon className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        {/* Status & Parking */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-2 mb-2 text-primary">
                                    <ShieldCheckIcon className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Lốt đỗ</span>
                                </div>
                                <p className="text-sm font-black text-gray-800">{selectedVehicle.parkingStatus || 'Không có lốt'}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-2 mb-2 text-orange-500">
                                    <ClockIcon className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Ngày ĐK</span>
                                </div>
                                <p className="text-sm font-black text-gray-800">{new Date(selectedVehicle.StartDate).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>

                        {/* Real Photo */}
                        {selectedVehicle.documents?.vehiclePhoto?.url && (
                            <div className="space-y-2">
                                <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Ảnh thực tế</h5>
                                <div className="rounded-[2rem] overflow-hidden border border-gray-200 shadow-inner bg-slate-200">
                                    <img src={selectedVehicle.documents.vehiclePhoto.url} className="w-full h-auto" alt="Vehicle" />
                                </div>
                            </div>
                        )}

                        {/* Bottom Actions */}
                        <div className="pt-4 grid grid-cols-2 gap-3 sticky bottom-0 bg-white pb-2">
                             <button className="py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 shadow-lg">
                                <PencilSquareIcon className="w-4 h-4" /> Chỉnh sửa
                            </button>
                            {/* Fix: Added missing TrashIcon import to fix the "Cannot find name 'TrashIcon'" error. */}
                            <button className="py-4 bg-rose-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-200">
                                <TrashIcon className="w-4 h-4" /> Xóa xe
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>
            
            {/* Image Preview Overlay (nếu có nhấn vào ảnh trong tương lai) */}
            {previewUrl && (
                <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
                     <img src={previewUrl} className="max-w-full max-h-full rounded-xl" alt="Full" />
                </div>
            )}
        </div>
    );
};

export default AdminPortalVehiclesPage;
