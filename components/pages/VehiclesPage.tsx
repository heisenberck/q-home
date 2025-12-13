
import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle, Unit, Owner, Role, ActivityLog, VehicleTier, VehicleDocument } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import { 
    CarIcon, SearchIcon, PencilSquareIcon, WarningIcon, UploadIcon, 
    TrashIcon, MotorbikeIcon, BikeIcon, EBikeIcon, 
    ShieldCheckIcon, DocumentArrowDownIcon,
    XMarkIcon, UserIcon, PhoneArrowUpRightIcon,
    CurrencyDollarIcon, ClockIcon, CheckCircleIcon,
    SparklesIcon, PaperclipIcon, ArrowUturnLeftIcon, EyeIcon
} from '../ui/Icons';
import { translateVehicleType, vehicleTypeLabels, compressImageToWebP, timeAgo, getPastelColorForName, parseUnitCode } from '../../utils/helpers';
import { isProduction } from '../../utils/env';

declare const XLSX: any;

// --- Constants & Types ---

const PARKING_STATUS_LABELS: Record<string, string> = {
    'Lốt chính': 'Lốt chính',
    'Lốt tạm': 'Lốt phụ', 
    'Xếp lốt': 'Đang chờ lốt',
    'None': 'Không có'
};

type EnhancedVehicle = Vehicle & { 
    ownerName: string; 
    ownerPhone: string;
    waitingPriority?: number;
    isBillable: boolean;
};

interface VehiclesPageProps {
    vehicles: Vehicle[];
    units: Unit[];
    owners: Owner[];
    activityLogs: ActivityLog[];
    onSetVehicles: (updater: React.SetStateAction<Vehicle[]>, logPayload?: any) => void;
    role: Role;
}

// --- Helper Components ---

const DocumentPreviewModal: React.FC<{
    doc: VehicleDocument;
    onClose: () => void;
}> = ({ doc, onClose }) => {
    const isImage = doc.type.startsWith('image/');
    const isPdf = doc.type === 'application/pdf' || doc.url.startsWith('data:application/pdf');

    return (
        <Modal title={`Xem tài liệu: ${doc.name}`} onClose={onClose} size="4xl">
            <div className="flex justify-center items-center p-4 bg-gray-100 min-h-[70vh]">
                {isImage ? (
                    <img src={doc.url} alt={doc.name} className="max-w-full max-h-[70vh] object-contain shadow-lg" />
                ) : isPdf ? (
                    <iframe src={doc.url} className="w-full h-[70vh] border-0" title={doc.name}></iframe>
                ) : (
                    <div className="text-center">
                        <p className="text-lg mb-4">Định dạng file này không hỗ trợ xem trước.</p>
                        <a href={doc.url} download={doc.name} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">
                            <DocumentArrowDownIcon /> Tải xuống
                        </a>
                    </div>
                )}
            </div>
        </Modal>
    );
};

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

// --- Duplicate Manager Component ---

interface DuplicateGroup {
    plate: string;
    normalizedPlate: string;
    items: EnhancedVehicle[];
}

const DuplicateManager: React.FC<{
    vehicles: EnhancedVehicle[];
    onClose: () => void;
    onDeleteBatch: (idsToDelete: string[]) => void;
}> = ({ vehicles, onClose, onDeleteBatch }) => {
    const [groups, setGroups] = useState<DuplicateGroup[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        // 1. Group Logic
        const map = new Map<string, EnhancedVehicle[]>();
        
        vehicles.forEach(v => {
            if (!v.PlateNumber) return;
            // Normalize: Remove non-alphanumeric, Uppercase
            const normalized = v.PlateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (!map.has(normalized)) map.set(normalized, []);
            map.get(normalized)!.push(v);
        });

        // 2. Filter only duplicates
        const dupGroups: DuplicateGroup[] = [];
        const initialSelected = new Set<string>();

        map.forEach((items, key) => {
            if (items.length > 1) {
                // Sort by Created Date (Oldest first)
                // If StartDate is same, fallback to VehicleId
                items.sort((a, b) => new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime() || a.VehicleId.localeCompare(b.VehicleId));
                
                // Logic: Keep the FIRST one (Index 0), Select the rest for deletion
                for (let i = 1; i < items.length; i++) {
                    initialSelected.add(items[i].VehicleId);
                }

                dupGroups.push({
                    plate: key, // Using normalized key as group ID
                    normalizedPlate: key,
                    items
                });
            }
        });

        setGroups(dupGroups);
        setSelectedIds(initialSelected);
    }, [vehicles]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleExecute = () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(`Xác nhận xóa vĩnh viễn ${selectedIds.size} xe đã chọn?`)) {
            onDeleteBatch(Array.from(selectedIds));
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 -m-6 p-6 animate-fade-in-down">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-purple-600"/> Quét trùng lặp biển số
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Tìm thấy <strong className="text-red-600">{groups.length}</strong> nhóm biển số trùng nhau (cả chữ và số).
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2">
                        <ArrowUturnLeftIcon className="w-4 h-4"/> Quay lại
                    </button>
                    <button 
                        onClick={handleExecute} 
                        disabled={selectedIds.size === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <TrashIcon className="w-4 h-4"/> Xóa {selectedIds.size} xe đã chọn
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-4">
                {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4"/>
                        <p className="text-lg font-medium">Tuyệt vời! Không tìm thấy xe nào trùng lặp.</p>
                    </div>
                ) : (
                    groups.map(group => (
                        <div key={group.normalizedPlate} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                <span className="font-mono font-bold text-lg text-gray-800 tracking-wider">
                                    {group.items[0].PlateNumber} 
                                    <span className="text-xs text-gray-500 font-sans ml-2 font-normal">(Normalized: {group.normalizedPlate})</span>
                                </span>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">{group.items.length} bản ghi</span>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 text-left bg-gray-50 border-b border-gray-100">
                                        <th className="p-3 w-10 text-center">Xóa</th>
                                        <th className="p-3">Căn hộ</th>
                                        <th className="p-3">Chủ xe</th>
                                        <th className="p-3">Loại xe</th>
                                        <th className="p-3">Ngày ĐK</th>
                                        <th className="p-3">Trạng thái</th>
                                        <th className="p-3">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.items.map((v, idx) => {
                                        const isSelected = selectedIds.has(v.VehicleId);
                                        // Highlight logic: Selected rows get yellow background
                                        const rowClass = isSelected ? "bg-yellow-50" : "bg-white";
                                        
                                        return (
                                            <tr key={v.VehicleId} className={`${rowClass} border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors`}>
                                                <td className="p-3 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => toggleSelection(v.VehicleId)}
                                                        className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                                                        title="Tick để xóa xe này"
                                                    />
                                                </td>
                                                <td className="p-3 font-bold text-gray-800">{v.UnitID}</td>
                                                <td className="p-3 text-gray-700">{v.ownerName}</td>
                                                <td className="p-3"><VehicleTypeBadge type={v.Type}/></td>
                                                <td className="p-3 text-gray-600 font-mono">{new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
                                                <td className="p-3"><StatusBadge status={v.parkingStatus}/></td>
                                                <td className="p-3">
                                                    {idx === 0 && !isSelected ? (
                                                        <span className="text-xs font-bold text-green-600 border border-green-200 bg-green-50 px-2 py-1 rounded">Giữ lại (Cũ nhất)</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-red-500">Trùng lặp</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- Edit Modal ---

const VehicleEditModal: React.FC<{
    vehicle: Vehicle;
    onSave: (vehicle: Vehicle, reason: string) => void;
    onClose: () => void;
}> = ({ vehicle: initialVehicle, onSave, onClose }) => {
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState<'info' | 'parking' | 'docs'>('info');
    
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [otherReason, setOtherReason] = useState('');

    const toggleReason = (r: string) => {
        setSelectedReasons(prev => 
            prev.includes(r) ? prev.filter(i => i !== r) : [...prev, r]
        );
    };

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
                    ...(prev.documents || {}),
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
        } catch { showToast('Lỗi tải ảnh.', 'error'); }
        if (e.target) e.target.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const checkboxPart = selectedReasons.join(', ');
        const finalReason = [checkboxPart, otherReason.trim()].filter(Boolean).join('. ');

        if (!finalReason) {
            showToast('Vui lòng chọn hoặc nhập lý do thay đổi.', 'error');
            return;
        }

        const cleanVehicle: Vehicle = {
            VehicleId: vehicle.VehicleId,
            UnitID: vehicle.UnitID,
            Type: vehicle.Type,
            VehicleName: vehicle.VehicleName || '',
            PlateNumber: vehicle.PlateNumber || '',
            StartDate: vehicle.StartDate,
            isActive: vehicle.isActive,
            parkingStatus: vehicle.parkingStatus || null,
            documents: vehicle.documents || {},
            log: vehicle.log || null,
            updatedAt: new Date().toISOString()
        };

        onSave(cleanVehicle, finalReason);
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
                                <input name="PlateNumber" value={vehicle.PlateNumber} onChange={handleChange} className={`${inputClass} font-mono font-bold uppercase`}/>
                            </div>
                            <div>
                                <label className={labelClass}>Loại xe</label>
                                <select name="Type" value={vehicle.Type} onChange={handleChange} className={inputClass}>
                                    {Object.entries(vehicleTypeLabels).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Tên xe / Model</label>
                                <input name="VehicleName" value={vehicle.VehicleName || ''} onChange={handleChange} className={inputClass}/>
                            </div>
                        </div>
                    )}

                    {activeTab === 'parking' && (
                        <div className="space-y-4 animate-fade-in-down">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Trạng thái đỗ</label>
                                    <select name="parkingStatus" value={vehicle.parkingStatus || ''} onChange={handleChange} className={inputClass} disabled={!isCar}>
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
                                    {vehicle.documents?.[type as 'registration'|'vehiclePhoto']?.url ? (
                                        <>
                                            <img 
                                                src={vehicle.documents[type as 'registration'|'vehiclePhoto']!.url} 
                                                className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50 group-hover:opacity-100 transition-opacity" 
                                                alt={type}
                                            />
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

                <div className="pt-4 border-t mt-auto">
                    <label className={labelClass}>Lý do thay đổi <span className="text-red-500">*</span></label>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {["Cập nhật biển số", "Cập nhật loại xe", "Cập nhật hình ảnh", "Cập nhật lốt xe"].map(r => (
                            <label key={r} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded -ml-1 select-none">
                                <input 
                                    type="checkbox" 
                                    checked={selectedReasons.includes(r)}
                                    onChange={() => toggleReason(r)}
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">{r}</span>
                            </label>
                        ))}
                    </div>

                    <input 
                        type="text"
                        value={otherReason} 
                        onChange={e => setOtherReason(e.target.value)} 
                        className={inputClass} 
                        placeholder="Chi tiết khác (tùy chọn, VD: Đổi xe mới...)"
                    />

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
    onClose: () => void,
    onOpenDoc: (doc: VehicleDocument) => void
}> = ({ vehicle, activityLogs, onEdit, onDelete, onClose, onOpenDoc }) => {
    const theme = getPastelColorForName(vehicle.ownerName);

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
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><PaperclipIcon className="w-4 h-4"/> Hồ sơ & Tài liệu</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Đăng ký xe</p>
                            {vehicle.documents?.registration?.url ? (
                                <div 
                                    onClick={() => vehicle.documents?.registration && onOpenDoc(vehicle.documents.registration)} 
                                    className="block h-24 w-full rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                                >
                                    <img src={vehicle.documents.registration.url} alt="Registration" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <EyeIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-24 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">
                                    Chưa có ảnh
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Ảnh xe</p>
                            {vehicle.documents?.vehiclePhoto?.url ? (
                                <div 
                                    onClick={() => vehicle.documents?.vehiclePhoto && onOpenDoc(vehicle.documents.vehiclePhoto)} 
                                    className="block h-24 w-full rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                                >
                                    <img src={vehicle.documents.vehiclePhoto.url} alt="Vehicle" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <EyeIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-24 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">
                                    Chưa có ảnh
                                </div>
                            )}
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
    const [isDuplicateMode, setIsDuplicateMode] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

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

            const s = searchTerm.toLowerCase();
            if (s && !(
                v.PlateNumber.toLowerCase().includes(s) || 
                v.UnitID.toLowerCase().includes(s) || 
                v.ownerName.toLowerCase().includes(s)
            )) return false;

            if (typeFilter !== 'all' && v.Type !== typeFilter) return false;
            if (statusFilter !== 'all') {
                if (statusFilter === 'assigned' && !['Lốt chính', 'Lốt tạm'].includes(v.parkingStatus || '')) return false;
                if (statusFilter === 'waiting' && v.parkingStatus !== 'Xếp lốt') return false;
            }

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
                unitCompare = pa.floor !== pb.floor ? pa.floor - pb.floor : pa.apt - pb.apt;
            } else {
                unitCompare = a.UnitID.localeCompare(b.UnitID);
            }
            if (unitCompare !== 0) return unitCompare;
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
        if (selectedVehicle?.VehicleId === updatedVehicle.VehicleId) {
            const refreshed = enhancedVehicles.find(v => v.VehicleId === updatedVehicle.VehicleId);
            if (refreshed) setSelectedVehicle({ ...refreshed, ...updatedVehicle });
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

    // Bulk Delete from Duplicate Manager
    const handleBatchDelete = (idsToDelete: string[]) => {
        onSetVehicles(prev => prev.map(v => idsToDelete.includes(v.VehicleId) ? { ...v, isActive: false } : v), {
            module: 'Vehicles',
            action: 'BATCH_DELETE_DUPLICATES',
            summary: `Xóa ${idsToDelete.length} xe trùng lặp biển số`,
            count: idsToDelete.length,
            ids: idsToDelete
        });
        showToast(`Đã xóa ${idsToDelete.length} xe trùng lặp.`, 'success');
        setIsDuplicateMode(false);
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {editingVehicle && <VehicleEditModal vehicle={editingVehicle} onSave={handleSave} onClose={() => setEditingVehicle(null)} />}
            {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

            {/* DUPLICATE MODE vs NORMAL MODE */}
            {isDuplicateMode ? (
                <div className="w-full h-full">
                    <DuplicateManager 
                        vehicles={enhancedVehicles.filter(v => v.isActive)}
                        onClose={() => setIsDuplicateMode(false)}
                        onDeleteBatch={handleBatchDelete}
                    />
                </div>
            ) : (
                <>
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
                                <button onClick={() => setIsDuplicateMode(true)} className="h-10 px-4 bg-white border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 flex items-center gap-2 transition-colors whitespace-nowrap">
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
                                onOpenDoc={setPreviewDoc}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default VehiclesPage;
