
import React, { useMemo, useState, useEffect } from 'react';
import type { Unit, Owner, Vehicle, VehicleDocument } from '../../../types';
import { 
    HomeIcon, UserIcon, SearchIcon, PhoneArrowUpRightIcon, 
    ChevronRightIcon, ChevronDownIcon, ChevronUpIcon,
    EnvelopeIcon, CarIcon, DocumentTextIcon, PaperclipIcon,
    UserCircleIcon, MotorbikeIcon, KeyIcon, StoreIcon
} from '../../ui/Icons';
import { parseUnitCode, translateVehicleType, getPastelColorForName } from '../../../utils/helpers';
import Modal from '../../ui/Modal';

interface AdminPortalResidentsPageProps {
    units?: Unit[];
    owners?: Owner[];
    vehicles?: Vehicle[];
}

const ResidentStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string; isActive: boolean; onClick: () => void }> = ({ label, value, icon, color, bgColor, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`p-3 rounded-2xl shadow-sm border transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 ${
            isActive ? `${bgColor} ${color} border-current ring-2 ring-current ring-offset-2` : 'bg-white border-gray-100 text-gray-400'
        }`}
    >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : bgColor}`}>
            {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${isActive ? 'text-white' : color}` })}
        </div>
        <div className="text-center">
            <p className={`text-[9px] font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-sm font-black leading-none mt-0.5 ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</p>
        </div>
    </div>
);

const AdminPortalResidentsPage: React.FC<AdminPortalResidentsPageProps> = ({ units = [], owners = [], vehicles = [] }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

    // Deep-linking & Scroll logic
    useEffect(() => {
        const targetId = localStorage.getItem('admin_portal_focus_id');
        if (targetId && !targetId.includes('VEH')) {
            setExpandedUnitId(targetId);
            localStorage.removeItem('admin_portal_focus_id');
            
            setTimeout(() => {
                const element = document.getElementById(`resident-card-${targetId}`);
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, []);
    
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

        if (statusFilter) {
            result = result.filter(u => u.Status === statusFilter);
        }

        return result.sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 0, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 0, apt: 0 };
            return pa.floor !== pb.floor ? pa.floor - pb.floor : pa.apt - pb.apt;
        });
    }, [units, owners, search, statusFilter]);

    const toggleStatusFilter = (status: string) => {
        setStatusFilter(statusFilter === status ? null : status);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {previewDoc && (
                <Modal title={previewDoc.name} onClose={() => setPreviewDoc(null)} size="4xl">
                     <div className="flex justify-center bg-gray-100 p-2 rounded-lg">
                        {previewDoc.type.startsWith('image/') ? (
                            <img src={previewDoc.url} className="max-h-[70vh] object-contain" alt={previewDoc.name} />
                        ) : (
                            <iframe src={previewDoc.url} className="w-full h-[70vh]" title={previewDoc.name} />
                        )}
                     </div>
                </Modal>
            )}

            <div className="p-4 grid grid-cols-3 gap-2 shrink-0">
                <ResidentStatCard label="Chính chủ" value={stats.owner} icon={<UserIcon />} color="text-emerald-600" bgColor="bg-emerald-50" isActive={statusFilter === 'Owner'} onClick={() => toggleStatusFilter('Owner')} />
                <ResidentStatCard label="Hộ thuê" value={stats.rent} icon={<KeyIcon />} color="text-blue-600" bgColor="bg-blue-50" isActive={statusFilter === 'Rent'} onClick={() => toggleStatusFilter('Rent')} />
                <ResidentStatCard label="Kinh doanh" value={stats.business} icon={<StoreIcon />} color="text-amber-600" bgColor="bg-amber-50" isActive={statusFilter === 'Business'} onClick={() => toggleStatusFilter('Business')} />
            </div>

            <div className="px-4 pb-3 sticky top-0 z-20">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm cư dân, mã căn hộ..." 
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setExpandedUnitId(null); }}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm transition-all font-bold"
                    />
                </div>
            </div>

            <div className="divide-y divide-gray-100 pb-24">
                {filtered.map(unit => {
                    const owner = (owners || []).find(o => o.OwnerID === unit.OwnerID);
                    const isExpanded = expandedUnitId === unit.UnitID;
                    const unitVehicles = (vehicles || []).filter(v => v.UnitID === unit.UnitID && v.isActive);
                    const unitTheme = getPastelColorForName(unit.UnitID);

                    return (
                        <div key={unit.UnitID} id={`resident-card-${unit.UnitID}`} className={`bg-white transition-all ${isExpanded ? 'ring-2 ring-primary shadow-md my-2' : ''}`}>
                            <div 
                                onClick={() => setExpandedUnitId(isExpanded ? null : unit.UnitID)}
                                className={`p-4 flex items-center justify-between active:bg-gray-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                                        isExpanded ? 'bg-primary text-white scale-110' : `${unitTheme.bg} ${unitTheme.text} ${unitTheme.border} opacity-80`
                                    }`}>
                                        {unit.UnitID}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-black text-gray-800 truncate">{owner?.OwnerName || 'Chưa cập nhật'}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                                            {unit.Status === 'Owner' ? 'Chính chủ' : unit.Status === 'Rent' ? 'Hộ thuê' : 'Kinh doanh'} • {unit.Area_m2}m²
                                        </p>
                                    </div>
                                </div>
                                <div className="text-gray-300">
                                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-primary" /> : <ChevronDownIcon className="w-5 h-5" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 animate-fade-in-down border-t border-gray-100 pt-4">
                                    <div className="grid grid-cols-1 gap-2.5">
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><PhoneArrowUpRightIcon className="w-4 h-4" /></div>
                                            <a href={`tel:${owner?.Phone}`} className="text-sm font-black text-blue-600">{owner?.Phone || '---'}</a>
                                        </div>
                                        {owner?.Email && (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600"><EnvelopeIcon className="w-4 h-4" /></div>
                                                <p className="text-xs font-bold text-gray-700 truncate">{owner.Email}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">Xe tại căn ({unitVehicles.length})</h5>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {unitVehicles.map(v => (
                                                <div key={v.VehicleId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        {v.Type.includes('car') ? <CarIcon className="w-4 h-4 text-blue-500"/> : <MotorbikeIcon className="w-4 h-4 text-orange-500"/>}
                                                        <span className="font-mono text-xs font-black text-gray-800 tracking-tight">{v.PlateNumber}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-400">{v.parkingStatus || 'Không lốt'}</span>
                                                </div>
                                            ))}
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

export default AdminPortalResidentsPage;
