


import React, { useState, useMemo, useCallback } from 'react';
import type { Vehicle, Unit, Owner, Role, VehicleDocument } from '../../types';
import { VehicleTier } from '../../types';
import Modal from '../ui/Modal';
import { useNotification } from '../../App';
import { CarIcon, SearchIcon, PencilSquareIcon, DocumentArrowDownIcon, WarningIcon, ListBulletIcon, ActionViewIcon, UploadIcon, TrashIcon, DocumentTextIcon, EyeIcon } from '../ui/Icons';

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
            // When changing type, if it's not a car anymore, reset parkingStatus
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: 'registration' | 'title' | 'nationalId') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('File quá lớn. Vui lòng chọn file dưới 5MB.', 'error');
            return;
        }
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
            showToast('Định dạng file không hỗ trợ. Chỉ chấp nhận PDF, JPG, PNG.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const newDoc: VehicleDocument = {
                fileId: `DOC_${Date.now()}`,
                name: file.name,
                url: base64,
                type: file.type,
                uploadedAt: new Date().toISOString()
            };
            
            setVehicle(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    [docType]: newDoc
                }
            }));
            showToast(`Đã tải lên ${file.name}`, 'success');
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveFile = (docType: 'registration' | 'title' | 'nationalId') => {
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

        // Validation Rules
        if (isCar && !vehicle.documents?.registration) {
            showToast('Ô tô bắt buộc phải có Đăng ký xe (Attach file).', 'error');
            return;
        }
        if (!isCar && vehicle.parkingStatus) {
             // Should be prevented by UI, but double check
             showToast('Trạng thái đỗ xe chỉ áp dụng cho Ô tô.', 'error');
             return;
        }

        onSave(vehicle);
    };
    
    const inputStyle = "w-full p-2 border rounded-md bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border focus:ring-primary focus:border-primary";

    return (
        <Modal title={`Chỉnh sửa xe: ${initialVehicle.PlateNumber}`} onClose={onClose} size="2xl">
            {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Căn hộ</label>
                        <input type="text" value={vehicle.UnitID} disabled className={`${inputStyle} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Biển số</label>
                        <input type="text" name="PlateNumber" value={vehicle.PlateNumber} onChange={handleChange} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Loại xe</label>
                        <select name="Type" value={vehicle.Type} onChange={handleChange} className={inputStyle}>
                            {Object.values(VehicleTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
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
                            className={`${inputStyle} ${!isCar ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`}
                            disabled={!isCar}
                        >
                            <option value="">Không có / N/A</option>
                            <option value="Lốt chính">Lốt chính</option>
                            <option value="Lốt tạm">Lốt tạm</option>
                            <option value="Xếp lốt">Xếp lốt</option>
                        </select>
                    </div>
                </div>

                {/* Attachments Section */}
                <div className="border-t dark:border-dark-border pt-4">
                    <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5" /> Hồ sơ đính kèm
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        {/* Registration (Required for Car) */}
                        <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    Đăng ký xe {isCar && <span className="text-red-500">*</span>}
                                </label>
                                {vehicle.documents?.registration ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 truncate max-w-[150px]">{vehicle.documents.registration.name}</span>
                                        <button type="button" onClick={() => setPreviewDoc(vehicle.documents!.registration!)} className="text-blue-600 hover:text-blue-800 text-xs underline">Xem</button>
                                        <button type="button" onClick={() => handleRemoveFile('registration')} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                                        <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'registration')} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Title (Optional) */}
                        <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium">Sổ đỏ / HĐMB (Tùy chọn)</label>
                                {vehicle.documents?.title ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 truncate max-w-[150px]">{vehicle.documents.title.name}</span>
                                        <button type="button" onClick={() => setPreviewDoc(vehicle.documents!.title!)} className="text-blue-600 hover:text-blue-800 text-xs underline">Xem</button>
                                        <button type="button" onClick={() => handleRemoveFile('title')} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                                        <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'title')} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* ID Card (Optional) */}
                        <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium">CCCD / CMND (Tùy chọn)</label>
                                {vehicle.documents?.nationalId ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 truncate max-w-[150px]">{vehicle.documents.nationalId.name}</span>
                                        <button type="button" onClick={() => setPreviewDoc(vehicle.documents!.nationalId!)} className="text-blue-600 hover:text-blue-800 text-xs underline">Xem</button>
                                        <button type="button" onClick={() => handleRemoveFile('nationalId')} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                                        <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'nationalId')} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Hỗ trợ: PDF, JPG, PNG. Tối đa 5MB/file.</p>
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

// --- Vehicle View Modal ---
const VehicleViewModal: React.FC<{
    vehicle: any; // Using any to accept the enhanced vehicle type easily
    onClose: () => void;
}> = ({ vehicle, onClose }) => {
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);
    const docTypes = [
        { key: 'registration' as const, label: 'Đăng ký xe' },
        { key: 'title' as const, label: 'Sổ đỏ' },
        { key: 'nationalId' as const, label: 'CCCD' },
    ];

    return (
        <Modal title={`Chi tiết xe: ${vehicle.PlateNumber}`} onClose={onClose} size="2xl">
             {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
            <div className="space-y-6">
                <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3 dark:border-dark-border">Thông tin Chủ hộ & Căn hộ</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="font-medium text-gray-500 dark:text-gray-400">Chủ hộ:</div>
                        <div>{vehicle.ownerName}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Căn hộ:</div>
                        <div>{vehicle.UnitID}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Số điện thoại:</div>
                        <div>{vehicle.ownerPhone}</div>
                    </div>
                </section>
                
                <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3 dark:border-dark-border">Thông tin Phương tiện</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="font-medium text-gray-500 dark:text-gray-400">Loại xe:</div>
                        <div>{vehicle.Type}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Tên xe:</div>
                        <div>{vehicle.VehicleName}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Biển số:</div>
                        <div className="font-mono">{vehicle.PlateNumber}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Ngày ĐK:</div>
                        <div>{new Date(vehicle.StartDate).toLocaleDateString('vi-VN')}</div>
                        <div className="font-medium text-gray-500 dark:text-gray-400">Trạng thái đỗ:</div>
                        <div>{vehicle.parkingStatus || 'Không áp dụng'}</div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3 dark:border-dark-border">Hồ sơ đính kèm</h3>
                    <div className="space-y-2">
                        {docTypes.map(({ key, label }) => {
                            const doc = vehicle.documents?.[key];
                            return (
                                <div key={key} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                    <span className="font-medium">{label}:</span>
                                    {doc ? (
                                         <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500 truncate max-w-[120px]">{doc.name}</span>
                                            <button onClick={() => setPreviewDoc(doc)} className="text-blue-600 hover:underline text-xs font-semibold">Xem</button>
                                            <a href={doc.url} download={doc.name} className="text-gray-600 hover:text-gray-900 text-xs"><DocumentArrowDownIcon className="w-4 h-4"/></a>
                                         </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">Chưa có file</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </Modal>
    );
};

// --- Vehicle Management Page ---
interface VehiclesPageProps {
    vehicles: Vehicle[];
    units: Unit[];
    owners: Owner[];
    onSetVehicles: (vehicles: Vehicle[]) => void;
    role: Role;
}

const VehicleManagementPage: React.FC<VehiclesPageProps> = ({ vehicles, units, owners, onSetVehicles, role }) => {
    const { showToast } = useNotification();
    const canEdit = ['Admin', 'Accountant', 'Operator'].includes(role);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [parkingStatusFilter, setParkingStatusFilter] = useState('all');
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [viewingVehicle, setViewingVehicle] = useState<any | null>(null);

    const ownersMap = useMemo(() => new Map(owners.map(o => [o.OwnerID, o])), [owners]);
    const unitsMap = useMemo(() => new Map(units.map(u => [u.UnitID, u])), [units]);

    const enhancedVehicles = useMemo(() => vehicles
        .filter(v => v.isActive)
        .map(v => {
            const unit = unitsMap.get(v.UnitID);
            const owner = unit ? ownersMap.get(unit.OwnerID) : undefined;
            return { ...v, ownerName: owner?.OwnerName ?? 'N/A', ownerPhone: owner?.Phone ?? '' };
        })
        .sort((a, b) => {
            const pa = parseUnitCode(a.UnitID);
            const pb = parseUnitCode(b.UnitID);
            if (pa && pb) {
                if (pa.floor !== pb.floor) return pa.floor - pb.floor;
                if (pa.apt !== pb.apt) return pa.apt - pb.apt;
            }
            return new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime();
        }),
    [vehicles, unitsMap, ownersMap]);

    const filteredVehicles = useMemo(() => enhancedVehicles.filter(v => {
        if (typeFilter === 'all_cars') {
            if (v.Type !== VehicleTier.CAR && v.Type !== VehicleTier.CAR_A) return false;
        } else if (typeFilter !== 'all' && v.Type !== typeFilter) {
            return false;
        }

        if (parkingStatusFilter !== 'all' && v.parkingStatus !== (parkingStatusFilter === 'none' ? null : parkingStatusFilter)) return false;
        
        if (searchTerm && !(
            v.PlateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.UnitID.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
        )) return false;
        
        return true;
    }), [enhancedVehicles, searchTerm, typeFilter, parkingStatusFilter]);
    
    const parkingStats = useMemo(() => {
        const cars = enhancedVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A);
        return {
            totalCars: cars.length,
            mainSlotsUsed: cars.filter(c => c.parkingStatus === 'Lốt chính').length,
            tempSlotsUsed: cars.filter(c => c.parkingStatus === 'Lốt tạm').length,
            waitingList: cars.filter(c => c.parkingStatus === 'Xếp lốt').sort((a, b) => new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime()),
        }
    }, [enhancedVehicles]);

    const handleSave = (updatedVehicle: Vehicle) => {
        const oldVehicle = vehicles.find(v => v.VehicleId === updatedVehicle.VehicleId);
        const newVehicles = vehicles.map(v => v.VehicleId === updatedVehicle.VehicleId ? updatedVehicle : v);
        onSetVehicles(newVehicles);
        setEditingVehicle(null);
        showToast(`Đã cập nhật thông tin xe ${updatedVehicle.PlateNumber}.`, 'success');

        const wasParked = oldVehicle?.parkingStatus === 'Lốt chính' || oldVehicle?.parkingStatus === 'Lốt tạm';
        const isNowNotParked = updatedVehicle.parkingStatus !== 'Lốt chính' && updatedVehicle.parkingStatus !== 'Lốt tạm';

        if (wasParked && isNowNotParked) {
            const nextInLine = parkingStats.waitingList[0];
            if (nextInLine) {
                showToast(`Lốt đỗ xe đã trống. Đề xuất duyệt xe ${nextInLine.PlateNumber} (đăng ký ${new Date(nextInLine.StartDate).toLocaleDateString('vi-VN')}) vào lốt.`, 'info', 8000);
            }
        }
    };

    const handleExport = () => {
        if (filteredVehicles.length === 0) {
            showToast('Không có dữ liệu để xuất.', 'info');
            return;
        }

        const headers = ['Căn hộ', 'Chủ hộ', 'SĐT', 'Loại xe', 'Tên xe', 'Biển số', 'Ngày ĐK', 'Trạng thái đỗ'];
        const csvRows = [headers.join(',')];

        filteredVehicles.forEach(v => {
            const row = [
                v.UnitID,
                `"${v.ownerName}"`,
                `"${v.ownerPhone}"`,
                v.Type,
                `"${v.VehicleName}"`,
                v.PlateNumber,
                new Date(v.StartDate).toLocaleDateString('vi-VN'),
                v.parkingStatus || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `DanhSachPhuongTien_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Đã xuất thành công ${filteredVehicles.length} dòng.`, 'success');
    };
    
    const parkingStatusDisplay = (v: Vehicle) => {
        const isCar = v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A;
        if (!isCar) return <span className="text-gray-400 text-xs">N/A</span>;
        
        if (!v.parkingStatus) return <span className="text-gray-400 text-xs">None</span>;
        
        const styles = {
            'Lốt chính': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            'Lốt tạm': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            'Xếp lốt': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[v.parkingStatus]}`}>{v.parkingStatus}</span>;
    };
    
    return (
        <div className="h-full flex flex-col space-y-4">
            {editingVehicle && <VehicleEditModal vehicle={editingVehicle} onSave={handleSave} onClose={() => setEditingVehicle(null)} />}
            {viewingVehicle && <VehicleViewModal vehicle={viewingVehicle} onClose={() => setViewingVehicle(null)} />}
            
            <div className="sticky top-0 z-10 bg-light-bg dark:bg-dark-bg -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-2 space-y-3">
                <div className="stats-row">
                    <div className="stat-card" data-label="Tổng số ô tô đăng ký" onClick={() => { setTypeFilter('all_cars'); setParkingStatusFilter('all'); }}>
                        <div className="stat-icon"><CarIcon /></div>
                        <p className="stat-value">{parkingStats.totalCars}</p>
                    </div>
                    <div className="stat-card" data-label="Số lốt chính đã sử dụng" onClick={() => setParkingStatusFilter('Lốt chính')}>
                        <div className="stat-icon"><ListBulletIcon /></div>
                        <p className="stat-value">{`${parkingStats.mainSlotsUsed} / ${PARKING_CAPACITY.main}`}</p>
                    </div>
                    <div className="stat-card" data-label="Số lốt tạm đã sử dụng" onClick={() => setParkingStatusFilter('Lốt tạm')}>
                        <div className="stat-icon"><WarningIcon /></div>
                        <p className="stat-value">{`${parkingStats.tempSlotsUsed} / ${PARKING_CAPACITY.temp}`}</p>
                    </div>
                    <div className="stat-card" data-label="Số xe trong danh sách chờ" onClick={() => setParkingStatusFilter('Xếp lốt')}>
                        <div className="stat-icon"><ListBulletIcon /></div>
                        <p className="stat-value">{parkingStats.waitingList.length}</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 p-2 bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-xl border dark:border-dark-border shadow-sm">
                    <div className="relative flex-grow min-w-[200px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm biển số, căn hộ, chủ hộ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"/></div>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"><option value="all">Tất cả loại xe</option><option value="all_cars">Tất cả ô tô</option><option value="car">Ô tô</option><option value="car_a">Ô tô hạng A</option><option value="motorbike">Xe máy</option><option value="ebike">Xe điện</option><option value="bicycle">Xe đạp</option></select>
                    <select value={parkingStatusFilter} onChange={e => setParkingStatusFilter(e.target.value)} className="p-2 border rounded-lg bg-light-bg dark:bg-dark-bg"><option value="all">Tất cả trạng thái</option><option value="Lốt chính">Lốt chính</option><option value="Lốt tạm">Lốt tạm</option><option value="Xếp lốt">Xếp lốt</option><option value="none">Không có</option></select>
                    <div className="relative group inline-block ml-auto">
                        <button onClick={handleExport} className="px-4 py-2 bg-primary text-white font-semibold rounded-md flex items-center gap-2"><DocumentArrowDownIcon /> Export</button>
                    </div>
                </div>
            </div>

            <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto">
                    <table className="min-w-full themed-table vehicle-table">
                        <thead className="text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="col-unit">Căn hộ</th>
                                <th className="col-owner">Chủ hộ</th>
                                <th className="col-type">Loại xe</th>
                                <th className="col-name">Tên xe</th>
                                <th className="col-plate">Biển số</th>
                                <th className="col-date">Ngày ĐK</th>
                                <th className="col-status">Trạng thái đỗ</th>
                                <th className="col-actions text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredVehicles.map(v => (
                                <tr key={v.VehicleId}>
                                    <td className="font-medium col-unit">{v.UnitID}</td>
                                    <td className="col-owner">{v.ownerName}</td>
                                    <td className="col-type">{v.Type}</td>
                                    <td className="col-name">{v.VehicleName}</td>
                                    <td className="font-mono col-plate">{v.PlateNumber}</td>
                                    <td className="col-date">{new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
                                    <td className="col-status">{parkingStatusDisplay(v)}</td>
                                    <td className="text-center col-actions">
                                        <div className="action-icons">
                                            <button 
                                                onClick={() => setViewingVehicle(v)} 
                                                className="icon-btn text-blue-600 hover:text-blue-800"
                                                data-tooltip="Xem chi tiết"
                                            >
                                                <ActionViewIcon />
                                            </button>
                                            <button 
                                                onClick={() => setEditingVehicle(v)} 
                                                disabled={!canEdit} 
                                                className="icon-btn"
                                                data-tooltip="Sửa thông tin"
                                            >
                                                <PencilSquareIcon />
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
    );
};

export default VehicleManagementPage;
