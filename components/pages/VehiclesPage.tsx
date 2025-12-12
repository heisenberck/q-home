
import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle, Unit, Owner, Role, ActivityLog, VehicleTier } from '../../types';
// FIX: Import from Context directly
import { useNotification } from '../../contexts/AppContext';
import Modal from '../ui/Modal';
import { 
    CarIcon, SearchIcon, PencilSquareIcon, WarningIcon, UploadIcon, 
    TrashIcon, MotorbikeIcon, BikeIcon, EBikeIcon, 
    ShieldCheckIcon, DocumentArrowDownIcon,
    XMarkIcon, UserIcon, PhoneArrowUpRightIcon,
    CurrencyDollarIcon, ClockIcon, CheckCircleIcon,
    SparklesIcon
} from '../ui/Icons';
import { formatLicensePlate, translateVehicleType, vehicleTypeLabels, compressImageToWebP, timeAgo, getPastelColorForName, parseUnitCode } from '../../utils/helpers';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { isProduction } from '../../utils/env';

declare const XLSX: any;

// --- Constants & Types ---

const PARKING_STATUS_LABELS: Record<string, string> = {
    'Lốt chính': 'Lốt chính',
    'Lốt tạm': 'Lốt phụ', // Renamed per requirement
    'Xếp lốt': 'Đang chờ lốt',
    'None': 'Không có'
};

type EnhancedVehicle = Vehicle & { 
    ownerName: string; 
    ownerPhone: string;
    waitingPriority?: number; // Calculated dynamic index
    isBillable: boolean;
};

interface VehiclesPageProps {
    vehicles: Vehicle[];
    units: Unit[];
    owners: Owner[];
    activityLogs: ActivityLog[]; // Added prop
    onSetVehicles: (updater: React.SetStateAction<Vehicle[]>, logPayload?: any) => void;
    role: Role;
}

// --- Helper Components ---

const StatusBadge: React.FC<{ status: Vehicle['parkingStatus'], priority?: number }> = ({ status, priority }) => {
    if (!status) return <span className="text-gray-400 text-xs italic">Chưa gán</span>;

    if (status === 'Lốt chính') {
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 w-fit"><CheckCircleIcon className="w-3 h-3"/> Lốt chính</span>;
    }
    if (status === 'Lốt tạm') {
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit"><ShieldCheckIcon className="w-3 h-3"/> Lốt phụ</span>;
    }
    if (status === 'Xếp lốt') {
        return <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-fit"><ClockIcon className="w-3 h-3"/> Chờ #{priority || '?'}</span>;
    }
    return null;
};

const VehicleTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    let icon = <CarIcon className="w-4 h-4"/>;
    let colorClass = "bg-gray-100 text-gray-800 border-gray-200";

    if (type.includes('car')) {
        colorClass = "bg-blue-50 text-blue-800 border-blue-200";
    } else if (type === 'motorbike') {
        icon = <MotorbikeIcon className="w-4 h-4"/>;
        colorClass = "bg-orange-50 text-orange-800 border-orange-200";
    } else if (type === 'ebike') {
        icon = <EBikeIcon className="w-4 h-4"/>;
        colorClass = "bg-green-50 text-green-800 border-green-200";
    } else if (type === 'bicycle') {
        icon = <BikeIcon className="w-4 h-4"/>;
        colorClass = "bg-purple-50 text-purple-800 border-purple-200";
    }

    return (
        <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex items-center gap-1 w-fit border ${colorClass}`}>
            {icon} {translateVehicleType(type as VehicleTier)}
        </span>
    );
};

// --- Edit Modal (Refactored) ---

const REASON_OPTIONS = [
    "Cập nhật biển số",
    "Cập nhật loại xe",
    "Cập nhật hình ảnh",
    "Cập nhật lốt xe"
];

const VehicleEditModal: React.FC<{
    vehicle: Vehicle;
    onSave: (vehicle: Vehicle, reason: string) => void;
    onClose: () => void;
}> = ({ vehicle: initialVehicle, onSave, onClose }) => {
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState<'info' | 'parking' | 'docs'>('info');
    
    // Updated State for Reason Logic
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [otherReason, setOtherReason] = useState('');

    const [vehicle, setVehicle] = useState<Vehicle>({ 
        ...initialVehicle,
        documents: initialVehicle.documents || {}
    });

    const isCar = vehicle.Type === 'car' || vehicle.Type === 'car_a';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setVehicle(prev => {
            const newState = { ...prev, [name]: value };
            return newState;
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'registration' | 'vehiclePhoto') => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            showToast('Đang xử lý ảnh...', 'info');
            const url = await compressImageToWebP(file);
            setVehicle(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    [docType]: {
                        fileId: `DOC_${Date.now()}`,
                        name: file.name,
                        url,
                        type: 'image/webp',
                        uploadedAt: new Date().toISOString()
                    }
                }
            }));
            showToast('Đã tải ảnh lên.', 'success');
            // Auto-check "Cập nhật hình ảnh" if not already checked
            if (!selectedReasons.includes("Cập nhật hình ảnh")) {
                setSelectedReasons(prev => [...prev, "Cập nhật hình ảnh"]);
            }
        } catch { showToast('Lỗi tải ảnh.', 'error'); }
        if (e.target) e.target.value = '';
    };

    const toggleReason = (reason: string) => {
        setSelectedReasons(prev => 
            prev.includes(reason) 
                ? prev.filter(r => r !== reason) 
                : [...prev, reason]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Construct final reason string
        const parts = [...selectedReasons];
        if (otherReason.trim()) parts.push(otherReason.trim());
        
        const finalReason = parts.join(', ');

        if (!finalReason) {
            showToast('Vui lòng chọn hoặc nhập lý do thay đổi.', 'error');
            return;
        }
        
        // Ensure standard Sanitization is respected implicitly by onSave -> service layer
        onSave(vehicle, finalReason);
    };

    const tabClass = (tab: string) => `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm";
    const labelClass = "block text-xs font-semibold text-gray-700 mb-1 uppercase";

    return (
        <Modal title={`Cập nhật xe: ${initialVehicle.PlateNumber}`} onClose={onClose} size="xl">
            <form onSubmit={handleSubmit} className="flex flex-col h-[70vh]">
                <div className="flex border-b border-gray-200 mb-4 sticky top-0 bg-white z-10">
                    <button type="button" onClick={() => setActiveTab('info')} className={tabClass('info')}>Thông tin chung</button>
                    <button type="button" onClick={() => setActiveTab('parking')} className={tabClass('parking')}>Vận hành & Phí</button>
                    <button type="button" onClick={() => setActiveTab('docs')} className={tabClass('docs')}>Hình ảnh</button>
                </div>

                <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
                    {activeTab === 'info' && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in-down">
                            <div>
                                <label className={labelClass}>Căn hộ</label>
                                <input value={vehicle.UnitID} disabled className={`${inputClass} bg-gray-100 cursor-not-allowed`}/>
                            </div>
                            <div>
                                <label className={labelClass}>Biển số</label>
                                <input 
                                    name="PlateNumber" 
                                    value={vehicle.PlateNumber} 
                                    onChange={handleChange} 
                                    className={`${inputClass} font-mono font-bold uppercase`}
                                    // Auto-check reason on change
                                    onBlur={() => {
                                        if (vehicle.PlateNumber !== initialVehicle.PlateNumber && !selectedReasons.includes("Cập nhật biển số")) {
                                            setSelectedReasons(prev => [...prev, "Cập nhật biển số"]);
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Loại xe</label>
                                <select 
                                    name="Type" 
                                    value={vehicle.Type} 
                                    onChange={(e) => {
                                        handleChange(e);
                                        if (e.target.value !== initialVehicle.Type && !selectedReasons.includes("Cập nhật loại xe")) {
                                            setSelectedReasons(prev => [...prev, "Cập nhật loại xe"]);
                                        }
                                    }} 
                                    className={inputClass}
                                >
                                    {Object.entries(vehicleTypeLabels).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Tên xe / Model</label>
                                <input name="VehicleName" value={vehicle.VehicleName} onChange={handleChange} className={inputClass}/>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parking' && (
                        <div className="space-y-4 animate-fade-in-down">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Trạng thái đỗ</label>
                                    <select 
                                        name="parkingStatus" 
                                        value={vehicle.parkingStatus || ''} 
                                        onChange={(e) => {
                                            handleChange(e);
                                            if (e.target.value !== (initialVehicle.parkingStatus || '') && !selectedReasons.includes("Cập nhật lốt xe")) {
                                                setSelectedReasons(prev => [...prev, "Cập nhật lốt xe"]);
                                            }
                                        }} 
                                        className={inputClass} 
                                        disabled={!isCar}
                                    >
                                        <option value="">Không có</option>
                                        <option value="Lốt chính">Lốt chính</option>
                                        <option value="Lốt tạm">Lốt phụ (Ngoài giờ/Ghép)</option>
                                        <option value="Xếp lốt">Đang chờ (Waitlist)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Ngày đăng ký</label>
                                    <input type="date" name="StartDate" value={vehicle.StartDate.split('T')[0]} onChange={handleChange} className={inputClass}/>
                                </div>
                            </div>
                            
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
                                <div className="flex gap-2">
                                    <CurrencyDollarIcon className="w-5 h-5 flex-shrink-0"/>
                                    <div>
                                        <p className="font-bold">Quy định tính phí:</p>
                                        <ul className="list-disc ml-4 mt-1 space-y-1 text-xs">
                                            <li><strong>Lốt chính / Lốt phụ:</strong> Tính phí theo biểu giá.</li>
                                            <li><strong>Đang chờ / Không có:</strong> Không tính phí.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in-down">
                            {['registration', 'vehiclePhoto'].map((type) => (
                                <div key={type} className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors h-40 relative group">
                                    {vehicle.documents?.[type as 'registration'|'vehiclePhoto'] ? (
                                        <>
                                            <img src={vehicle.documents[type as 'registration'|'vehiclePhoto']!.url} className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative z-10">
                                                <button type="button" onClick={() => setVehicle(p => {const d={...p.documents}; delete d[type as 'registration'|'vehiclePhoto']; return {...p, documents:d}})} className="bg-red-500 text-white px-3 py-1 rounded text-xs shadow">Xóa ảnh</button>
                                            </div>
                                        </>
                                    ) : (
                                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                                            <UploadIcon className="w-8 h-8 text-gray-400 mb-2"/>
                                            <span className="text-sm font-medium text-gray-600">{type === 'registration' ? 'Đăng ký xe' : 'Ảnh xe'}</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, type as any)} />
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- Refactored Reason Input --- */}
                <div className="pt-4 border-t mt-auto bg-white">
                    <label className={labelClass}>Lý do thay đổi <span className="text-red-500">*</span></label>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            {REASON_OPTIONS.map(opt => (
                                <label key={opt} className="flex items-center space-x-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedReasons.includes(opt)}
                                        onChange={() => toggleReason(opt)}
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700">{opt}</span>
                                </label>
                            ))}
                        </div>
                        <input 
                            type="text"
                            value={otherReason}
                            onChange={e => setOtherReason(e.target.value)}
                            placeholder="Chi tiết khác (tùy chọn). VD: Đổi xe mới..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium text-sm">Hủy</button>
                        <button type="submit" className="px-5 py-2 rounded-lg text-white bg-primary hover:bg-primary-focus font-bold shadow-lg text-sm">Lưu thay đổi</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

// --- Detail Panel (Right Side) ---

const VehicleDetailPanel: React.FC<{
    vehicle: EnhancedVehicle,
    activityLogs: ActivityLog[],
    onEdit: (v: Vehicle) => void,
    onDelete: (v: Vehicle) => void,
    onClose: () => void
}> = ({ vehicle, activityLogs, onEdit, onDelete, onClose }) => {
    const theme = getPastelColorForName(vehicle.ownerName); // Reuse resident color helper

    const relevantLogs = useMemo(() => {
        return activityLogs.filter(log => 
            (log.ids && log.ids.includes(vehicle.VehicleId)) || 
            log.summary.includes(vehicle.PlateNumber)
        ).slice(0, 10);
    }, [activityLogs, vehicle.VehicleId, vehicle.PlateNumber]);

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-2xl overflow-y-auto animate-slide-up">
            <div className={`p-6 ${theme.bg} relative`}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/40 hover:bg-white/70 text-gray-700"><XMarkIcon className="w-5 h-5" /></button>
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm mb-3 border-4 border-white">
                        {vehicle.Type.includes('car') ? '🚗' : '🛵'}
                    </div>
                    <h2 className="text-2xl font-mono font-bold text-gray-900 tracking-wider">{vehicle.PlateNumber}</h2>
                    <p className="text-sm font-medium text-gray-600 mt-1">{vehicle.VehicleName}</p>
                    <div className="mt-3">
                        {vehicle.Type.includes('car') ? (
                           <StatusBadge status={vehicle.parkingStatus} priority={vehicle.waitingPriority} />
                        ) : (
                           <span className="text-gray-400 text-xs italic">N/A</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8 flex-1">
                {/* Info Section */}
                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Chủ sở hữu</h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-500">Chủ hộ</span>
                            <span className="text-sm font-bold text-gray-900">{vehicle.ownerName}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-500">Căn hộ</span>
                            <span className="text-sm font-bold bg-white border px-2 rounded">{vehicle.UnitID}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Liên hệ</span>
                            <a href={`tel:${vehicle.ownerPhone}`} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"><PhoneArrowUpRightIcon className="w-3 h-3"/> {vehicle.ownerPhone}</a>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldCheckIcon className="w-4 h-4"/> Thông tin Vận hành</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Ngày đăng ký</span>
                            <span className="font-medium">{new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                            <span className="text-gray-500">Trạng thái phí</span>
                            {vehicle.isBillable 
                                ? <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-0.5 rounded">Được tính phí</span> 
                                : <span className="text-gray-500 font-bold text-xs bg-gray-100 px-2 py-0.5 rounded">Miễn phí / Chờ</span>}
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ClockIcon className="w-4 h-4"/> Lịch sử Thay đổi</h3>
                    <div className="border-l-2 border-gray-100 pl-4 space-y-4">
                        {relevantLogs.length > 0 ? relevantLogs.map(log => (
                            <div key={log.id} className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white"></div>
                                <p className="text-xs text-gray-400 mb-0.5">{timeAgo(log.ts)}</p>
                                <p className="text-sm text-gray-800">{log.summary}</p>
                                <p className="text-[10px] text-gray-500 italic mt-1">Bởi: {log.actor_email}</p>
                            </div>
                        )) : <p className="text-sm text-gray-400 italic">Chưa có lịch sử ghi nhận.</p>}
                    </div>
                </section>

                <div className="mt-auto pt-4 flex gap-3 border-t">
                    <button onClick={() => onEdit(vehicle)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"><PencilSquareIcon className="w-4 h-4"/> Cập nhật</button>
                    <button onClick={() => onDelete(vehicle)} className="flex-1 py-2 bg-white border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 flex items-center justify-center gap-2 text-sm"><TrashIcon className="w-4 h-4"/> Xóa xe</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

const VehiclesPage: React.FC<VehiclesPageProps> = ({ vehicles, units, owners, activityLogs, onSetVehicles, role }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Accountant', 'Operator'].includes(role);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [kpiFilter, setKpiFilter] = useState<'all' | 'cars' | 'motos' | 'assigned' | 'waiting'>('all');

    // Selection & Modals
    const [selectedVehicle, setSelectedVehicle] = useState<EnhancedVehicle | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

    // --- 1. Data Processing ---
    const ownersMap = useMemo(() => new Map(owners.map(o => [o.OwnerID, o])), [owners]);

    // Calculate Waiting List Priorities
    const waitingListMap = useMemo(() => {
        const waiting = vehicles
            .filter(v => v.isActive && v.parkingStatus === 'Xếp lốt')
            .sort((a, b) => a.StartDate.localeCompare(b.StartDate)); // FIFO
        
        const map = new Map<string, number>();
        waiting.forEach((v, i) => map.set(v.VehicleId, i + 1));
        return map;
    }, [vehicles]);

    const enhancedVehicles = useMemo((): EnhancedVehicle[] => {
        return vehicles.map(v => {
            const unit = units.find(u => u.UnitID === v.UnitID);
            const owner = unit ? ownersMap.get(unit.OwnerID) : undefined;
            
            // Business Logic: Billable if Main or Extra Slot
            const isBillable = v.isActive && (v.parkingStatus === 'Lốt chính' || v.parkingStatus === 'Lốt tạm');
            
            return {
                ...v,
                ownerName: owner?.OwnerName ?? 'Unknown',
                ownerPhone: owner?.Phone ?? '',
                waitingPriority: waitingListMap.get(v.VehicleId),
                isBillable
            };
        });
    }, [vehicles, units, ownersMap, waitingListMap]);

    // --- 2. Filtering ---
    const filteredVehicles = useMemo(() => {
        return enhancedVehicles.filter(v => {
            if (!v.isActive) return false;

            // Search
            const s = searchTerm.toLowerCase();
            if (s && !(
                v.PlateNumber.toLowerCase().includes(s) || 
                v.UnitID.toLowerCase().includes(s) || 
                v.ownerName.toLowerCase().includes(s)
            )) return false;

            // Toolbar Filters
            if (typeFilter !== 'all' && v.Type !== typeFilter) return false;
            if (statusFilter !== 'all') {
                if (statusFilter === 'assigned' && !['Lốt chính', 'Lốt tạm'].includes(v.parkingStatus || '')) return false;
                if (statusFilter === 'waiting' && v.parkingStatus !== 'Xếp lốt') return false;
            }

            // Dashboard KPI Filter
            if (kpiFilter === 'cars' && !(v.Type === 'car' || v.Type === 'car_a')) return false;
            if (kpiFilter === 'motos' && !(v.Type === 'motorbike' || v.Type === 'ebike')) return false;
            if (kpiFilter === 'assigned' && !['Lốt chính', 'Lốt tạm'].includes(v.parkingStatus || '')) return false;
            if (kpiFilter === 'waiting' && v.parkingStatus !== 'Xếp lốt') return false;

            return true;
        }).sort((a, b) => {
            const pa = parseUnitCode(a.UnitID);
            const pb = parseUnitCode(b.UnitID);
            let unitCompare = 0;
            if (pa && pb) {
                if (pa.floor !== pb.floor) {
                    unitCompare = pa.floor - pb.floor;
                } else {
                    unitCompare = pa.apt - pb.apt;
                }
            } else {
                unitCompare = a.UnitID.localeCompare(b.UnitID);
            }

            if (unitCompare !== 0) return unitCompare;

            // Secondary sort by plate number
            return a.PlateNumber.localeCompare(b.PlateNumber);
        });
    }, [enhancedVehicles, searchTerm, typeFilter, statusFilter, kpiFilter]);

    // --- 3. KPI Stats ---
    const stats = useMemo(() => {
        const active = enhancedVehicles.filter(v => v.isActive);
        return {
            cars: active.filter(v => v.Type.includes('car')).length,
            motos: active.filter(v => v.Type === 'motorbike' || v.Type === 'ebike').length,
            assigned: active.filter(v => v.parkingStatus === 'Lốt chính' || v.parkingStatus === 'Lốt tạm').length,
            waiting: active.filter(v => v.parkingStatus === 'Xếp lốt').length
        };
    }, [enhancedVehicles]);

    // --- 4. Handlers ---
    const handleSave = (updatedVehicle: Vehicle, reason: string) => {
        onSetVehicles(prev => prev.map(v => v.VehicleId === updatedVehicle.VehicleId ? updatedVehicle : v), {
            module: 'Vehicles', 
            action: 'UPDATE', 
            summary: `Cập nhật xe ${updatedVehicle.PlateNumber}. Lý do: ${reason}`, 
            ids: [updatedVehicle.VehicleId]
        });
        showToast('Cập nhật thành công.', 'success');
        setEditingVehicle(null);
        
        // Refresh selection
        if (selectedVehicle?.VehicleId === updatedVehicle.VehicleId) {
            const refreshed = enhancedVehicles.find(v => v.VehicleId === updatedVehicle.VehicleId);
            if (refreshed) setSelectedVehicle({ ...refreshed, ...updatedVehicle }); // Merge updates
        }
    };

    const handleDelete = (vehicle: Vehicle) => {
        if (!window.confirm(`Bạn chắc chắn muốn xóa xe ${vehicle.PlateNumber}?`)) return;
        const reason = prompt("Nhập lý do xóa (Bắt buộc):");
        if (!reason) return;

        onSetVehicles(prev => prev.map(v => v.VehicleId === vehicle.VehicleId ? { ...v, isActive: false } : v), {
            module: 'Vehicles', 
            action: 'DELETE', 
            summary: `Xóa xe ${vehicle.PlateNumber}. Lý do: ${reason}`, 
            ids: [vehicle.VehicleId]
        });
        showToast('Đã xóa xe.', 'success');
        setSelectedVehicle(null);
    };

    const handleExport = () => {
        if (filteredVehicles.length === 0) return showToast('Không có dữ liệu.', 'info');
        const data = filteredVehicles.map(v => ({
            'Căn hộ': v.UnitID,
            'Chủ hộ': v.ownerName,
            'Biển số': v.PlateNumber,
            'Loại xe': translateVehicleType(v.Type),
            'Trạng thái': PARKING_STATUS_LABELS[v.parkingStatus || 'None'],
            'Thứ tự chờ': v.waitingPriority || '',
            'Ngày ĐK': new Date(v.StartDate).toLocaleDateString('vi-VN')
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
        XLSX.writeFile(wb, `DanhSachXe_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleCleanupDuplicates = async () => {
        if (!window.confirm("BẠN CHẮC CHẮN MUỐN CHẠY CÔNG CỤ QUÉT TRÙNG?\n\nHành động này sẽ quét toàn bộ dữ liệu xe trên hệ thống (Firestore), tìm các biển số bị trùng lặp và XOÁ các bản ghi thừa (giữ lại bản ghi cũ nhất).\n\nHãy sao lưu dữ liệu trước khi thực hiện!")) return;
    
        showToast('Đang quét dữ liệu xe từ máy chủ...', 'info', 10000);
    
        try {
            const vehiclesRef = collection(db, 'vehicles');
            const snapshot = await getDocs(vehiclesRef);
            
            if (snapshot.empty) {
                showToast('Không tìm thấy dữ liệu xe nào.', 'info');
                return;
            }
    
            const plateMap = new Map<string, { id: string, createdAt: string }[]>();
            const allDuplicates: string[] = [];
    
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const rawPlate = data.PlateNumber;
                // Normalize: remove spaces, dots, dashes, uppercase
                if (!rawPlate) return;
                const normalizedPlate = String(rawPlate).trim().toUpperCase().replace(/[\s.-]/g, '');
                
                if (!plateMap.has(normalizedPlate)) {
                    plateMap.set(normalizedPlate, []);
                }
                
                // Try to find a creation date. StartDate is date string YYYY-MM-DD usually. updatedAt is ISO.
                // If neither, we rely on the order or random.
                const sortKey = data.updatedAt || data.StartDate || '0000-00-00';
                plateMap.get(normalizedPlate)!.push({ 
                    id: docSnap.id, 
                    createdAt: sortKey 
                });
            });
    
            let duplicateCount = 0;
            plateMap.forEach((records, plate) => {
                if (records.length > 1) {
                    // Sort ascending by createdAt (oldest first)
                    records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                    
                    // Keep the first (oldest), mark others for deletion
                    const [keep, ...remove] = records;
                    remove.forEach(r => allDuplicates.push(r.id));
                    duplicateCount += remove.length;
                    console.log(`[Duplicate] Plate ${plate}: Keeping ${keep.id}, Removing ${remove.map(r=>r.id).join(', ')}`);
                }
            });
    
            if (allDuplicates.length === 0) {
                showToast('Tuyệt vời! Không tìm thấy dữ liệu trùng lặp nào.', 'success');
                return;
            }
    
            if (!window.confirm(`Tìm thấy ${allDuplicates.length} bản ghi xe bị trùng lặp (dựa trên biển số).\n\nBạn có muốn XOÁ VĨNH VIỄN các bản ghi thừa này không?`)) {
                showToast('Đã huỷ thao tác.', 'info');
                return;
            }
    
            showToast(`Đang xoá ${allDuplicates.length} bản ghi...`, 'info', 5000);
    
            // Batch delete (max 500 per batch)
            const BATCH_SIZE = 450;
            for (let i = 0; i < allDuplicates.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = allDuplicates.slice(i, i + BATCH_SIZE);
                chunk.forEach(id => {
                    batch.delete(doc(db, 'vehicles', id));
                });
                await batch.commit();
            }
    
            showToast(`Đã xoá thành công ${allDuplicates.length} xe trùng. Đang tải lại trang...`, 'success', 3000);
            setTimeout(() => window.location.reload(), 2000);
    
        } catch (e: any) {
            console.error("Cleanup Error:", e);
            showToast(`Lỗi: ${e.message}`, 'error');
        }
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {editingVehicle && <VehicleEditModal vehicle={editingVehicle} onSave={handleSave} onClose={() => setEditingVehicle(null)} />}

            {/* MASTER VIEW (Left) */}
            <div className={`flex flex-col gap-6 min-w-0 transition-all duration-300 ${selectedVehicle ? 'w-2/3' : 'w-full'}`}>
                
                {/* 1. Dashboard Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={() => setKpiFilter(kpiFilter === 'cars' ? 'all' : 'cars')} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 cursor-pointer hover:bg-gray-50 transition-colors ${kpiFilter === 'cars' ? 'ring-2 ring-blue-500' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-full text-blue-600"><CarIcon className="w-6 h-6"/></div>
                            <div><p className="text-sm text-gray-500">Ô tô / A</p><p className="text-2xl font-bold text-gray-800">{stats.cars}</p></div>
                        </div>
                    </div>
                    <div onClick={() => setKpiFilter(kpiFilter === 'motos' ? 'all' : 'motos')} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500 cursor-pointer hover:bg-gray-50 transition-colors ${kpiFilter === 'motos' ? 'ring-2 ring-orange-500' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-50 rounded-full text-orange-600"><MotorbikeIcon className="w-6 h-6"/></div>
                            <div><p className="text-sm text-gray-500">Xe máy / Điện</p><p className="text-2xl font-bold text-gray-800">{stats.motos}</p></div>
                        </div>
                    </div>
                    <div onClick={() => setKpiFilter(kpiFilter === 'assigned' ? 'all' : 'assigned')} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 cursor-pointer hover:bg-gray-50 transition-colors ${kpiFilter === 'assigned' ? 'ring-2 ring-green-500' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-50 rounded-full text-green-600"><ShieldCheckIcon className="w-6 h-6"/></div>
                            <div><p className="text-sm text-gray-500">Đã cấp lốt</p><p className="text-2xl font-bold text-gray-800">{stats.assigned}</p></div>
                        </div>
                    </div>
                    <div onClick={() => setKpiFilter(kpiFilter === 'waiting' ? 'all' : 'waiting')} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500 cursor-pointer hover:bg-gray-50 transition-colors ${kpiFilter === 'waiting' ? 'ring-2 ring-red-500' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-50 rounded-full text-red-600"><ClockIcon className="w-6 h-6"/></div>
                            <div><p className="text-sm text-gray-500">Đang chờ lốt</p><p className="text-2xl font-bold text-gray-800">{stats.waiting}</p></div>
                        </div>
                    </div>
                </div>

                {/* 2. Toolbar */}
                <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input type="text" placeholder="Tìm biển số, căn hộ, chủ hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-4 border rounded-lg bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"/>
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary outline-none">
                        <option value="all">Tất cả trạng thái</option>
                        <option value="assigned">Đã cấp lốt</option>
                        <option value="waiting">Đang chờ</option>
                    </select>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-10 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary outline-none">
                        <option value="all">Tất cả loại xe</option>
                        <option value="car">{vehicleTypeLabels['car']}</option>
                        <option value="car_a">{vehicleTypeLabels['car_a']}</option>
                        <option value="motorbike">{vehicleTypeLabels['motorbike']}</option>
                        <option value="ebike">{vehicleTypeLabels['ebike']}</option>
                        <option value="bicycle">{vehicleTypeLabels['bicycle']}</option>
                    </select>
                    {(role === 'Admin') && (
                        <button onClick={handleCleanupDuplicates} className="h-10 px-4 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 flex items-center gap-2 transition-colors whitespace-nowrap">
                            <SparklesIcon className="w-5 h-5"/> Quét xe trùng
                        </button>
                    )}
                    <button onClick={handleExport} className="h-10 px-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors">
                        <DocumentArrowDownIcon className="w-5 h-5 text-gray-500"/> Export
                    </button>
                </div>

                {/* 3. Table */}
                <div className="bg-white rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden border border-gray-100">
                    <div className="overflow-y-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chủ hộ</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Biển số</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Loại xe</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái đỗ</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredVehicles.map(v => (
                                    <tr key={v.VehicleId} onClick={() => setSelectedVehicle(v)} className={`cursor-pointer transition-colors ${selectedVehicle?.VehicleId === v.VehicleId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{v.UnitID}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{v.ownerName}</td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-gray-800 text-base bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{v.PlateNumber}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center"><VehicleTypeBadge type={v.Type} /></div>
                                        </td>
                                        <td className="px-6 py-4 text-center flex justify-center">
                                            {v.Type.includes('car') ? (
                                                <StatusBadge status={v.parkingStatus} priority={v.waitingPriority} />
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingVehicle(v); }} 
                                                disabled={!canEdit}
                                                className="p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30"
                                            >
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DETAIL PANEL (Right) */}
            {selectedVehicle && (
                <div className="w-1/3 flex flex-col h-full animate-slide-up shadow-2xl rounded-l-xl overflow-hidden z-20">
                    <VehicleDetailPanel 
                        vehicle={selectedVehicle} 
                        activityLogs={activityLogs}
                        onEdit={(v) => setEditingVehicle(v)}
                        onDelete={() => handleDelete(selectedVehicle)}
                        onClose={() => setSelectedVehicle(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default VehiclesPage;
