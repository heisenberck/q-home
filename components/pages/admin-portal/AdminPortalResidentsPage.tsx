
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

const ResidentStatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bgColor: string }> = ({ label, value, icon, color, bgColor }) => (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${bgColor} ${color} flex items-center justify-center shrink-0`}>
            {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight truncate">{label}</p>
            <p className="text-sm font-black text-gray-800 leading-none mt-0.5">{value}</p>
        </div>
    </div>
);

const AdminPortalResidentsPage: React.FC<AdminPortalResidentsPageProps> = ({ units = [], owners = [], vehicles = [] }) => {
    const [search, setSearch] = useState('');
    const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

    // Deep-linking logic: Kiểm tra nếu được dẫn tới từ Search Home
    useEffect(() => {
        const targetId = localStorage.getItem('admin_portal_focus_id');
        if (targetId && !targetId.includes('-')) { // UnitID thường không chứa gạch ngang như VehicleId
            setExpandedUnitId(targetId);
            localStorage.removeItem('admin_portal_focus_id');
            // Scroll tới vị trí đó nếu cần (tùy chọn)
        }
    }, []);
    
    // Thống kê cư dân
    const stats = useMemo(() => {
        return {
            owner: (units || []).filter(u => u.Status === 'Owner').length,
            rent: (units || []).filter(u => u.Status === 'Rent').length,
            business: (units || []).filter(u => u.Status === 'Business').length,
            total: (units || []).length
        };
    }, [units]);

    const sortedUnits = useMemo(() => {
        return [...(units || [])].sort((a, b) => {
            const pa = parseUnitCode(a.UnitID) || { floor: 0, apt: 0 };
            const pb = parseUnitCode(b.UnitID) || { floor: 0, apt: 0 };
            return pa.floor !== pb.floor ? pa.floor - pb.floor : pa.apt - pb.apt;
        });
    }, [units]);

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return sortedUnits.filter(u => {
            const owner = (owners || []).find(o => o.OwnerID === u.OwnerID);
            return u.UnitID.toLowerCase().includes(s) || (owner?.OwnerName || '').toLowerCase().includes(s);
        });
    }, [sortedUnits, owners, search]);

    const toggleExpand = (unitId: string) => {
        setExpandedUnitId(expandedUnitId === unitId ? null : unitId);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Xem tài liệu nhanh */}
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

            {/* 1. Thống kê cư dân */}
            <div className="p-4 grid grid-cols-3 gap-2 shrink-0">
                <ResidentStatCard label="Chính chủ" value={stats.owner} icon={<UserIcon />} color="text-emerald-600" bgColor="bg-emerald-50" />
                <ResidentStatCard label="Hộ thuê" value={stats.rent} icon={<KeyIcon />} color="text-blue-600" bgColor="bg-blue-50" />
                <ResidentStatCard label="Kinh doanh" value={stats.business} icon={<StoreIcon />} color="text-amber-600" bgColor="bg-amber-50" />
            </div>

            {/* 2. Thanh tìm kiếm */}
            <div className="px-4 pb-3 bg-slate-50 sticky top-0 z-20">
                <div className="relative group">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Tìm cư dân, mã căn hộ..." 
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setExpandedUnitId(null);
                        }}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
                    />
                </div>
            </div>

            {/* 3. Danh sách cư dân */}
            <div className="divide-y divide-gray-100 pb-24">
                {filtered.map(unit => {
                    const owner = (owners || []).find(o => o.OwnerID === unit.OwnerID);
                    const isExpanded = expandedUnitId === unit.UnitID;
                    const unitVehicles = (vehicles || []).filter(v => v.UnitID === unit.UnitID && v.isActive);
                    const allDocs = [
                        ...(owner?.documents?.nationalId ? [{...owner.documents.nationalId, name: 'CCCD'}] : []),
                        ...(owner?.documents?.title ? [{...owner.documents.title, name: 'Sổ đỏ/HĐ'}] : []),
                        ...(owner?.documents?.others || [])
                    ];

                    const unitTheme = getPastelColorForName(unit.UnitID);

                    return (
                        <div key={unit.UnitID} id={`unit-card-${unit.UnitID}`} className={`bg-white transition-all ${isExpanded ? 'ring-1 ring-primary/20 shadow-md my-2' : ''}`}>
                            <div 
                                onClick={() => toggleExpand(unit.UnitID)}
                                className={`p-4 flex items-center justify-between active:bg-gray-50 transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all duration-300 border-2 ${
                                        isExpanded 
                                            ? 'bg-primary text-white border-primary shadow-lg scale-110' 
                                            : `${unitTheme.bg} ${unitTheme.text} ${unitTheme.border} opacity-90`
                                    }`}>
                                        {unit.UnitID}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-gray-800 truncate">{owner?.OwnerName || 'Chưa cập nhật'}</h4>
                                        <p className="text-[11px] text-gray-400 uppercase font-bold tracking-tight truncate">
                                            {unit.Status === 'Owner' ? 'Chính chủ' : unit.Status === 'Rent' ? 'Hộ thuê' : 'Kinh doanh'} • {unit.Area_m2}m²
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {owner?.Phone && !isExpanded && (
                                        <a 
                                            href={`tel:${owner.Phone}`} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 text-primary hover:bg-primary/10 rounded-full"
                                        >
                                            <PhoneArrowUpRightIcon className="w-5 h-5" />
                                        </a>
                                    )}
                                    <div className="text-gray-300">
                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-primary" /> : <ChevronDownIcon className="w-5 h-5" />}
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 animate-fade-in-down border-t border-gray-100 pt-4">
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                                <PhoneArrowUpRightIcon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Điện thoại</p>
                                                <a href={`tel:${owner?.Phone}`} className="text-sm font-bold text-blue-600">{owner?.Phone || '---'}</a>
                                            </div>
                                        </div>
                                        {owner?.Email && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
                                                    <EnvelopeIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Email</p>
                                                    <p className="text-sm font-semibold text-gray-700 truncate">{owner.Email}</p>
                                                </div>
                                            </div>
                                        )}
                                        {owner?.secondOwnerName && (
                                            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm">
                                                    <UserCircleIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Người liên hệ 2</p>
                                                    <p className="text-sm font-bold text-gray-700">{owner.secondOwnerName} <span className="font-normal text-gray-500">• {owner.secondOwnerPhone}</span></p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                            <CarIcon className="w-3 h-3"/> Xe sở hữu ({unitVehicles.length})
                                        </h5>
                                        {unitVehicles.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {unitVehicles.map(v => (
                                                    <div key={v.VehicleId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="flex items-center gap-2">
                                                            {v.Type.includes('car') ? <CarIcon className="w-4 h-4 text-blue-500"/> : <MotorbikeIcon className="w-4 h-4 text-orange-500"/>}
                                                            <span className="font-mono text-xs font-black text-gray-800 tracking-tight">{v.PlateNumber}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-400">{v.VehicleName || translateVehicleType(v.Type)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Chưa đăng ký phương tiện.</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                            <DocumentTextIcon className="w-3 h-3"/> Hồ sơ tài liệu ({allDocs.length})
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                            {allDocs.map((doc, idx) => (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => setPreviewDoc(doc)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                                                >
                                                    <PaperclipIcon className="w-3 h-3 text-gray-400" />
                                                    {doc.name}
                                                </button>
                                            ))}
                                            {allDocs.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có tài liệu đính kèm.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="p-10 text-center text-gray-400 text-sm italic flex flex-col items-center">
                    <SearchIcon className="w-10 h-10 opacity-20 mb-2"/>
                    Không tìm thấy căn hộ nào phù hợp.
                </div>
            )}
        </div>
    );
};

export default AdminPortalResidentsPage;
