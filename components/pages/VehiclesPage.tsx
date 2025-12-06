import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Vehicle, VehicleDocument, Unit, Owner, Role } from '../../types';
import { VehicleTier } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    CarIcon, SearchIcon, PencilSquareIcon, WarningIcon, UploadIcon, 
    TrashIcon, DocumentTextIcon, MotorbikeIcon, BikeIcon, EBikeIcon, ChevronLeftIcon, ChevronRightIcon, ShieldCheckIcon 
} from '../ui/Icons';
import { formatLicensePlate, translateVehicleType, vehicleTypeLabels, compressImageToWebP, timeAgo } from '../../utils/helpers';

const PARKING_CAPACITY = {
    main: 89,
    temp: 15,
};

// Helper function to parse unit IDs for sorting
const parseUnitCode = (code: string) => {
    const s = String(code).trim();
    if (s.startsWith('K')) return { floor: 99, apt: parseInt(s.substring(1), 10) || 0 };
    if (!/^\d{3,4}$/.test(s)) return null;
    let floor, apt;
    if (s.length === 3) {
        floor = parseInt(s.slice(0, 1), 10);
        apt = parseInt(s.slice(1), 10);
    } else { // 4 digits
        floor = parseInt(s.slice(0, 2), 10);
        apt = parseInt(s.slice(2), 10);
    }
    return { floor, apt };
};

// --- NEW: Document Preview Modal ---
const DocumentPreviewModal: React.FC<{
    doc: VehicleDocument;
    onClose: () => void;
}> = ({ doc, onClose }) => {
    const isImage = doc.type.startsWith('image/');
    const isPdf = doc.type === 'application/pdf';

    return (
        <Modal title={`Xem tài liệu: ${doc.name}`} onClose={onClose} size="4xl">
            <div className="flex justify-center items-center p-4 bg-gray-100 dark:bg-gray-900 min-h-[400px]">
                {isImage && <img src={doc.url} alt={doc.name} className="max-w-full max-h-[80vh] object-contain shadow-md" />}
                {isPdf && (
                    <iframe src={doc.url} className="w-full h-[80vh] shadow-md" title={doc.name}></iframe>
                )}
                {!isImage && !isPdf && (
                    <div className="text-center">
                        <p className="text-lg mb-4">Định dạng file này không hỗ trợ xem trước.</p>
                        <a href={doc.url} download={doc.name} className="px-4 py-2 bg-primary text-white rounded-md">Tải xuống</a>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// --- Vehicle Edit Modal ---
const VehicleEditModal: React.FC<{
    vehicle: Vehicle;
    onSave: (vehicle: Vehicle) => void;
    onClose: () => void;
}> = ({ vehicle: initialVehicle, onSave, onClose }) => {
    const { showToast } = useNotification();
    const [vehicle, setVehicle] = useState<Vehicle>({ 
        ...initialVehicle,
        documents: initialVehicle.documents || {}
    });
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

    const isCar = vehicle.Type === VehicleTier.CAR || vehicle.Type === VehicleTier.CAR_A;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'parkingStatus' && value === '') {
            setVehicle(prev => ({ ...prev, parkingStatus: null }));
        } else if (name === 'Type') {
            const newType = value as VehicleTier;
            const newIsCar = newType === VehicleTier.CAR || newType === VehicleTier.CAR_A;
            setVehicle(prev => ({ 
                ...prev, 
                Type: newType, 
                parkingStatus: newIsCar ? prev.parkingStatus : null 
            }));
        } else {
            setVehicle(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleLicensePlateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const formattedPlate = formatLicensePlate(e.target.value);
        setVehicle(prev => ({ ...prev, PlateNumber: formattedPlate }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'registration' | 'vehiclePhoto') => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        if (file.size > 10 * 1024 * 1024) {
            showToast('File quá lớn. Vui lòng chọn file dưới 10MB.', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('Chỉ chấp nhận file ảnh.', 'error');
            return;
        }
    
        try {
            showToast('Đang nén ảnh...', 'info');
            const compressedDataUrl = await compressImageToWebP(file);
            const newDoc: VehicleDocument = {
                fileId: `DOC_VEHICLE_${Date.now()}`,
                name: file.name.replace(/\.[^/.]+$/, ".webp"),
                url: compressedDataUrl,
                type: 'image/webp',
                uploadedAt: new Date().toISOString()
            };
            
            setVehicle(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    [docType]: newDoc
                }
            }));
            showToast(`Đã tải lên ${newDoc.name}`, 'success');
        } catch (error) {
            showToast('Lỗi khi nén ảnh.', 'error');
            console.error(error);
        }
        if (e.target) e.target.value = '';
    };

    const handleRemoveFile = (docType: 'registration' | 'vehiclePhoto') => {
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
             setVehicle(prev => {
                const newDocs = { ...prev.documents };
                delete newDocs[docType];
                return { ...prev, documents: newDocs };
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(vehicle);
    };
    
    const inputStyle = "w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-primary focus:border-primary";

    const FileUploadField: React.FC<{ docType: 'registration' | 'vehiclePhoto'; label: string; }> = ({ docType, label }) => {
        const doc = vehicle.documents?.[docType];
        return (
            <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{label}</label>
                    {doc ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 truncate max-w-[150px]">{doc.name}</span>
                            <button type="button" onClick={() => setPreviewDoc(doc)} className="text-blue-600 hover:text-blue-800 text-xs underline">Xem</button>
                            <button type="button" onClick={() => handleRemoveFile(docType)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                            <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, docType)} />
                        </label>
                    )}
                </div>
            </div>
        );
    };


    return (
        <Modal title={`Chỉnh sửa xe: ${initialVehicle.PlateNumber}`} onClose={onClose} size="2xl">
            {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Căn hộ</label>
                        <input type="text" value={vehicle.UnitID} disabled className={`${inputStyle} bg-gray-100 dark:bg-gray-800 cursor-not-allowed`} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Biển số</label>
                        <input type="text" name="PlateNumber" value={vehicle.PlateNumber} onChange={handleChange} onBlur={handleLicensePlateBlur} placeholder={isCar ? 'VD: 30E-12345' : 'VD: 29H1-12345'} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Loại xe</label>
                         <select name="Type" value={vehicle.Type} onChange={handleChange} className={inputStyle}>
                            <option value={VehicleTier.CAR}>{vehicleTypeLabels.car}</option>
                            <option value={VehicleTier.CAR_A}>{vehicleTypeLabels.car_a}</option>
                            <option value={VehicleTier.MOTORBIKE}>{vehicleTypeLabels.motorbike}</option>
                            <option value={VehicleTier.EBIKE}>{vehicleTypeLabels.ebike}</option>
                            <option value={VehicleTier.BICYCLE}>{vehicleTypeLabels.bicycle}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Tên xe</label>
                        <input type="text" name="VehicleName" value={vehicle.VehicleName} onChange={handleChange} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Ngày đăng ký</label>
                        <input type="date" name="StartDate" value={vehicle.StartDate.split('T')[0]} onChange={handleChange} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                            Trạng thái đỗ xe {isCar ? '' : '(Chỉ dành cho ô tô)'}
                        </label>
                        <select 
                            name="parkingStatus" 
                            value={vehicle.parkingStatus || ''} 
                            onChange={handleChange} 
                            className={`${inputStyle} ${!isCar ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`}
                            disabled={!isCar}
                        >
                            <option value="">Không có / N/A</option>
                            <option value="Lốt chính">Lốt chính</option>
                            <option value="Lốt tạm">Lốt tạm</option>
                            <option value="Xếp lốt">Xếp lốt</option>
                        </select>
                    </div>
                </div>
                <div className="border-t dark:border-dark-border pt-4">
                    <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5" /> Hồ sơ đính kèm
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FileUploadField docType="registration" label="Ảnh Đăng ký xe" />
                        <FileUploadField docType="vehiclePhoto" label="Ảnh chụp xe" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Hỗ trợ ảnh. File sẽ được nén dưới 200KB.</p>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Ghi chú (Lịch sử thay đổi...)</label>
                    <textarea name="log" value={vehicle.log || ''} onChange={handleChange} className={inputStyle} rows={3} />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-dark-border">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button>
                    <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">Lưu</button>
                </div>
            </form>
        </Modal>
    );
};

// --- NEW: Vehicle Dashboard Panel (Right side, default) ---
// FIX: Update prop types for vehicles and onSelectVehicle to use EnhancedVehicle for better type safety.
const VehicleDashboard: React.FC<{ vehicles: EnhancedVehicle[], onSelectVehicle: (vehicle: EnhancedVehicle) => void }> = ({ vehicles, onSelectVehicle }) => {
    const dashboardData = useMemo(() => {
        const active = vehicles.filter(v => v.isActive);
        const typeCounts = active.reduce((acc: Record<string, number>, v) => {
            const key = v.Type;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const pieData = Object.entries(typeCounts).map(([name, value]) => ({
            name: translateVehicleType(name as VehicleTier),
            value,
        }));

        const vehicleCountsByUnit = active.reduce((acc: Record<string, number>, v) => {
            acc[v.UnitID] = (acc[v.UnitID] || 0) + 1;
            return acc;
        }, {});

        const topOwners = Object.entries(vehicleCountsByUnit).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const recentUpdates = [...active].sort((a, b) => new Date(b.updatedAt || b.StartDate).getTime() - new Date(a.updatedAt || a.StartDate).getTime()).slice(0, 5);

        return { pieData, topOwners, recentUpdates };
    }, [vehicles]);

    const [activeSlide, setActiveSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const slides = ['pie', 'topOwners'];
    
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            // FIX: Explicitly type the 'prev' parameter as a number to resolve the arithmetic operation type error.
            setActiveSlide((prev: number) => (prev + 1) % slides.length)
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length, isPaused]);

    const COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#22c55e'];

    return (
        <div className="p-6 h-full flex flex-col">
            <div 
                className="relative flex-shrink-0"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                <h3 className="text-xl font-bold mb-4">Thống kê nổi bật</h3>
                <div className="h-[250px]">
                    {slides[activeSlide] === 'pie' && (
                        <div key="pie" className="animate-fade-in-down">
                            <h4 className="text-sm font-semibold text-center mb-2">Tỷ lệ các loại xe</h4>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={dashboardData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                        if (percent < 0.05) return null;
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                        return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
                                    }}>
                                        {dashboardData.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend iconSize={10} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {slides[activeSlide] === 'topOwners' && (
                         <div key="top" className="animate-fade-in-down">
                            <h4 className="text-sm font-semibold text-center mb-4">Top 5 căn hộ nhiều xe nhất</h4>
                            <ul className="space-y-2">
                                {dashboardData.topOwners.map(([unitId, count]) => (
                                    <li key={unitId} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                        <span className="font-medium">Căn hộ {unitId}</span>
                                        <span className="font-bold text-primary">{count} xe</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {/* FIX: Explicitly type the 'p' parameter in state setters to resolve arithmetic operation type errors. */}
                 <button onClick={() => setActiveSlide((p: number) => (p - 1 + slides.length) % slides.length)} className="absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-700 rounded-full shadow-md z-10"><ChevronLeftIcon /></button>
                 <button onClick={() => setActiveSlide((p: number) => (p + 1) % slides.length)} className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-700 rounded-full shadow-md z-10"><ChevronRightIcon /></button>
            </div>
            <div className="border-t dark:border-dark-border mt-6 pt-6 flex-1 flex flex-col min-h-0">
                <h3 className="text-lg font-bold mb-4">Các xe mới cập nhật</h3>
                <ul className="space-y-3 overflow-y-auto pr-2">
                   {dashboardData.recentUpdates.map(v => (
                       <li key={v.VehicleId} onClick={() => onSelectVehicle(v)} className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                           <div className="text-gray-500 dark:text-gray-400">{v.Type.includes('car') ? <CarIcon/> : (v.Type === VehicleTier.MOTORBIKE ? <MotorbikeIcon /> : <BikeIcon/>)}</div>
                           <div className="flex-grow">
                               <p className="font-semibold text-sm">{v.PlateNumber} <span className="text-xs font-normal text-gray-500">- Căn hộ {v.UnitID}</span></p>
                               <p className="text-xs text-gray-500">{timeAgo(v.updatedAt || v.StartDate)}</p>
                           </div>
                       </li>
                   ))}
                </ul>
            </div>
        </div>
    );
};

// --- Vehicle Detail Panel (Right side, on select) ---
// FIX: Update vehicle prop to use EnhancedVehicle type for type safety, resolving rendering errors.
const VehicleDetailPanel: React.FC<{ vehicle: EnhancedVehicle, onEdit: (vehicle: any) => void, onDelete: () => void }> = ({ vehicle, onEdit, onDelete }) => {
    return (
        <div className="p-6 h-full space-y-6">
            <header className="flex flex-col items-center text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-2">{vehicle.Type.includes('car') ? <CarIcon className="w-12 h-12"/> : <MotorbikeIcon className="w-12 h-12"/>}</div>
                <h2 className="text-3xl font-bold font-mono tracking-wider text-gray-900 dark:text-white">{vehicle.PlateNumber}</h2>
                {vehicle.parkingStatus && <span className="mt-2 text-sm font-semibold px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">{vehicle.parkingStatus}</span>}
            </header>
            
            <div className="border-t dark:border-dark-border pt-4">
                <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Thông tin xe</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Tên/Nhãn hiệu:</span><span className="font-semibold text-gray-900 dark:text-gray-200">{vehicle.VehicleName || 'Chưa có'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Ngày đăng ký:</span><span className="font-semibold text-gray-900 dark:text-gray-200">{new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</span></div>
                </div>
            </div>

            <div className="border-t dark:border-dark-border pt-4">
                 <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Chủ sở hữu</h3>
                 <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Chủ hộ:</span><span className="font-semibold text-gray-900 dark:text-gray-200">{vehicle.ownerName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Căn hộ:</span><span className="font-semibold text-gray-900 dark:text-gray-200">{vehicle.UnitID}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">SĐT:</span><span className="font-semibold text-gray-900 dark:text-gray-200">{vehicle.ownerPhone}</span></div>
                </div>
            </div>

            <div className="border-t dark:border-dark-border pt-4">
                <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Hình ảnh</h3>
                <div className="grid grid-cols-2 gap-4">
                    {vehicle.documents?.vehiclePhoto ? <img src={vehicle.documents.vehiclePhoto.url} className="w-full h-24 object-cover rounded-md border" alt="Ảnh xe"/> : <div className="w-full h-24 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">Ảnh xe</div>}
                    {vehicle.documents?.registration ? <img src={vehicle.documents.registration.url} className="w-full h-24 object-cover rounded-md border" alt="Ảnh đăng ký"/> : <div className="w-full h-24 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">Ảnh đăng ký</div>}
                </div>
            </div>

            <div className="border-t dark:border-dark-border pt-4 flex gap-3">
                <button onClick={() => onEdit(vehicle)} className="flex-1 px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">Chỉnh sửa</button>
                <button onClick={onDelete} className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700">Xóa</button>
            </div>
        </div>
    );
};

const ParkingStatusBadge: React.FC<{ status: Vehicle['parkingStatus'], queueNumber?: number }> = ({ status, queueNumber }) => {
    if (!status) return null;

    // FIX: Explicitly type `text` as a string to allow reassignment with a modified string.
    let text: string = status;
    let classes = '';

    switch (status) {
        case 'Lốt chính':
            classes = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            break;
        case 'Lốt tạm':
            classes = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
            break;
        case 'Xếp lốt':
            classes = 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
            if (queueNumber) {
                text = `Xếp lốt - ${queueNumber}`;
            }
            break;
        default:
            return null;
    }

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${classes}`}>
            {text}
        </span>
    );
};

// --- Vehicle Management Page ---
interface VehiclesPageProps {
    vehicles: Vehicle[];
    units: Unit[];
    owners: Owner[];
    onSetVehicles: (updater: React.SetStateAction<Vehicle[]>, logPayload?: any) => void;
    role: Role;
}
// FIX: Define a more specific type for vehicles with owner information to improve type safety.
type EnhancedVehicle = Vehicle & { ownerName: string; ownerPhone: string };

const VehiclesPage: React.FC<VehiclesPageProps> = ({ vehicles, units, owners, onSetVehicles, role }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Accountant', 'Operator'].includes(role);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [parkingStatusFilter, setParkingStatusFilter] = useState('all');
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    // FIX: Use the specific EnhancedVehicle type for the selected vehicle state.
    const [selectedVehicle, setSelectedVehicle] = useState<EnhancedVehicle | null>(null);

    const ownersMap = useMemo(() => new Map(owners.map(o => [o.OwnerID, o])), [owners]);
    const unitsMap = useMemo(() => new Map(units.map(u => [u.UnitID, u])), [units]);

    const xepLotQueue = useMemo(() => {
        const queueMap = new Map<string, number>();
        vehicles
            .filter(v => v.isActive && v.parkingStatus === 'Xếp lốt' && (v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A))
            .sort((a, b) => new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime())
            .forEach((v, index) => {
                queueMap.set(v.VehicleId, index + 1);
            });
        return queueMap;
    }, [vehicles]);

    // FIX: Provide an explicit return type for the useMemo hook.
    const enhancedVehicles = useMemo((): EnhancedVehicle[] => vehicles
        .map(v => {
            const unit = unitsMap.get(v.UnitID);
            const owner = unit ? ownersMap.get(unit.OwnerID) : undefined;
            return { ...v, ownerName: owner?.OwnerName ?? 'N/A', ownerPhone: owner?.Phone ?? '' };
        }),
    [vehicles, unitsMap, ownersMap]);

    const filteredVehicles = useMemo(() => enhancedVehicles.filter(v => {
        if (!v.isActive) return false;
        if (typeFilter !== 'all') {
            if (typeFilter === 'all_cars') {
                if (v.Type !== VehicleTier.CAR && v.Type !== VehicleTier.CAR_A) return false;
            } else if (v.Type !== typeFilter) {
                return false;
            }
        }
        if (parkingStatusFilter !== 'all') {
            const targetStatus = parkingStatusFilter === 'none' ? null : parkingStatusFilter;
            if (v.parkingStatus !== targetStatus && !(targetStatus === null && v.parkingStatus === undefined)) return false;
        }
        const s = searchTerm.toLowerCase();
        if (s && !(v.PlateNumber.toLowerCase().includes(s) || v.UnitID.toLowerCase().includes(s) || v.ownerName.toLowerCase().includes(s))) return false;
        return true;
    }).sort((a, b) => {
        const pa = parseUnitCode(a.UnitID) || { floor: 999, apt: 999 };
        const pb = parseUnitCode(b.UnitID) || { floor: 999, apt: 999 };
        if (pa.floor !== pb.floor) {
            return pa.floor - pb.floor;
        }
        return pa.apt - pb.apt;
    }), [enhancedVehicles, searchTerm, typeFilter, parkingStatusFilter]);
    
    const kpiStats = useMemo(() => {
        const active = enhancedVehicles.filter(v => v.isActive);
        
        const totalNormalCars = active.filter(v => v.Type === VehicleTier.CAR).length;
        const totalTypeACars = active.filter(v => v.Type === VehicleTier.CAR_A).length;

        const totalMotorbikes = active.filter(v => v.Type === VehicleTier.MOTORBIKE).length;
        const totalEBikes = active.filter(v => v.Type === VehicleTier.EBIKE).length;
        
        const allCars = active.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A);
        const mainParkingUsage = allCars.filter(v => v.parkingStatus === 'Lốt chính').length;
        const tempParkingUsage = allCars.filter(v => v.parkingStatus === 'Lốt tạm').length;
        const queuedForParking = allCars.filter(v => v.parkingStatus === 'Xếp lốt').length;

        return {
            totalNormalCars,
            totalTypeACars,
            totalMotorbikes,
            totalEBikes,
            mainParkingUsage,
            tempParkingUsage,
            queuedForParking,
        };
    }, [enhancedVehicles]);

    const handleEdit = (vehicle: Vehicle) => {
        if (!canEdit) {
            showToast('Bạn không có quyền chỉnh sửa.', 'error');
            return;
        }
        setEditingVehicle(vehicle);
    };

    const handleSave = (updatedVehicle: Vehicle) => {
        const logSummary = `Cập nhật thông tin xe BKS ${updatedVehicle.PlateNumber}`;
        onSetVehicles(
            prev => prev.map(v => v.VehicleId === updatedVehicle.VehicleId ? { ...updatedVehicle, updatedAt: new Date().toISOString() } : v),
            { module: 'Vehicles', action: 'UPDATE_VEHICLE', summary: logSummary, ids: [updatedVehicle.VehicleId] }
        );
        showToast('Cập nhật thành công!', 'success');
        setEditingVehicle(null);
        if (selectedVehicle?.VehicleId === updatedVehicle.VehicleId) {
            // Refresh detail view
            const unit = unitsMap.get(updatedVehicle.UnitID);
            const owner = unit ? ownersMap.get(unit.OwnerID) : undefined;
            setSelectedVehicle({ ...updatedVehicle, ownerName: owner?.OwnerName ?? 'N/A', ownerPhone: owner?.Phone ?? '' });
        }
    };

    const handleDelete = (vehicleToDelete: Vehicle) => {
        if (!canEdit) {
            showToast('Bạn không có quyền xóa.', 'error');
            return;
        }
        if (window.confirm(`Bạn có chắc muốn xóa xe BKS: ${vehicleToDelete.PlateNumber}?`)) {
            const logSummary = `Xóa (lưu trữ) xe BKS ${vehicleToDelete.PlateNumber}`;
            onSetVehicles(
                prev => prev.map(v => v.VehicleId === vehicleToDelete.VehicleId ? { ...v, isActive: false, log: `Deleted on ${new Date().toLocaleDateString()}` } : v),
                { module: 'Vehicles', action: 'DELETE_VEHICLE', summary: logSummary, ids: [vehicleToDelete.VehicleId] }
            );
            showToast(`Đã xóa xe ${vehicleToDelete.PlateNumber}.`, 'success');
            setSelectedVehicle(null);
        }
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {editingVehicle && <VehicleEditModal vehicle={editingVehicle} onSave={handleSave} onClose={() => setEditingVehicle(null)} />}
            
            {/* Left Column */}
            <div className="w-2/3 flex flex-col gap-4 min-w-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Tổng số Ô tô" value={<>{kpiStats.totalNormalCars} <span className="text-gray-400">/</span> {kpiStats.totalTypeACars}</>} subtext="Thường / Hạng A" icon={<CarIcon className="w-6 h-6 text-blue-600"/>} />
                    <StatCard label="Xe máy & Xe điện" value={<>{kpiStats.totalMotorbikes} <span className="text-gray-400">/</span> {kpiStats.totalEBikes}</>} subtext="Xe máy / Xe điện" icon={<MotorbikeIcon className="w-6 h-6 text-orange-600"/>} />
                    <StatCard label="Tình trạng lốt (ô tô)" value={<>{kpiStats.mainParkingUsage} <span className="text-gray-400">/</span> {kpiStats.tempParkingUsage}</>} subtext="Lốt chính / Lốt phụ" icon={<ShieldCheckIcon className="w-6 h-6 text-green-600"/>} />
                    <StatCard label="Đang chờ lốt" value={kpiStats.queuedForParking} icon={<WarningIcon className="w-6 h-6 text-red-600"/>} />
                </div>
                
                <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-grow">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Tìm biển số, căn hộ, chủ hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600"/>
                        </div>
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-10 px-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600">
                            <option value="all">Tất cả loại xe</option>
                            <option value="all_cars">Tất cả Ô tô</option>
                            <option value={VehicleTier.MOTORBIKE}>Xe máy</option>
                            <option value={VehicleTier.EBIKE}>Xe điện</option>
                            <option value={VehicleTier.BICYCLE}>Xe đạp</option>
                        </select>
                        <select value={parkingStatusFilter} onChange={e => setParkingStatusFilter(e.target.value)} className="h-10 px-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600">
                            <option value="all">Tất cả trạng thái đỗ</option>
                            <option value="Lốt chính">Lốt chính</option>
                            <option value="Lốt tạm">Lốt tạm</option>
                            <option value="Xếp lốt">Xếp lốt</option>
                            <option value="none">Chưa có</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col min-h-0">
                    <div className="overflow-y-auto pr-2">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chủ hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Biển số</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Loại xe</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Trạng thái đỗ</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredVehicles.map(v => (
                                    <tr key={v.VehicleId} onClick={() => setSelectedVehicle(v)} className={`cursor-pointer ${selectedVehicle?.VehicleId === v.VehicleId ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="font-semibold px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{v.UnitID}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-gray-900 dark:text-gray-200">{v.ownerName}</td>
                                        <td className="px-4 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">{v.PlateNumber}</td>
                                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{translateVehicleType(v.Type)}</td>
                                        <td className="px-4 py-4 text-sm text-center">
                                            <ParkingStatusBadge status={v.parkingStatus} queueNumber={xepLotQueue.get(v.VehicleId)} />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(v); }} disabled={!canEdit} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30" data-tooltip="Sửa">
                                                    <PencilSquareIcon className="w-5 h-5 text-blue-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="w-1/3 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm overflow-y-auto">
                {selectedVehicle ? (
                    <VehicleDetailPanel 
                        key={selectedVehicle.VehicleId} 
                        vehicle={selectedVehicle}
                        onEdit={handleEdit}
                        onDelete={() => handleDelete(selectedVehicle)}
                    />
                ) : (
                    <VehicleDashboard vehicles={enhancedVehicles} onSelectVehicle={setSelectedVehicle} />
                )}
            </div>
        </div>
    );
};

export default VehiclesPage;