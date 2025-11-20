import React, { useState, useRef, useMemo } from 'react';
import { MOCK_UNITS, MOCK_OWNERS, MOCK_VEHICLES } from '../constants';
import type { Unit, Owner, Vehicle } from '../types';
import { VehicleTier, UnitType } from '../types';
import { useAuth, useNotification } from '../App';

// Combined type for easier state management
type ResidentData = Unit & {
    owner: Owner;
    vehicles: Vehicle[];
};

// --- Resident Detail/Edit Modal ---
const ResidentDetailModal: React.FC<{
    resident: ResidentData;
    mode: 'view' | 'edit';
    onClose: () => void;
    onSave: (updatedData: ResidentData) => void;
}> = ({ resident, mode, onClose, onSave }) => {
    const [formData, setFormData] = useState<ResidentData>(JSON.parse(JSON.stringify(resident))); // Deep copy

    // NEW: Robust style constant for form elements to fix light/dark mode issues
    const formElementStyle = "mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400";

    const handleOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, owner: { ...prev.owner, [name]: value } }));
    };
    
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as any }));
    };

    const handleVehicleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [name]: value };
        setFormData(prev => ({ ...prev, vehicles: updatedVehicles }));
    };
    
    const handleAddVehicle = () => {
        // FIX: Updated vehicle properties to match the schema (Type, PlateNumber, StartDate, isActive).
        const newVehicle: Vehicle = {
            VehicleId: `VEH_NEW_${Date.now()}`,
            UnitID: formData.UnitID,
            Type: VehicleTier.MOTORBIKE, // Use enum for consistency
            VehicleName: '',
            PlateNumber: '',
            StartDate: new Date().toISOString().split('T')[0],
            isActive: true,
        };
        setFormData(prev => ({...prev, vehicles: [...prev.vehicles, newVehicle]}));
    };
    
    const handleRemoveVehicle = (index: number) => {
        const updatedVehicles = formData.vehicles.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, vehicles: updatedVehicles }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const isEditing = mode === 'edit';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-background dark:bg-dark-secondary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-dark-border-color flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                        {isEditing ? 'Sửa thông tin' : 'Chi tiết'} Cư dân - Căn hộ {resident.UnitID}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                        {/* Owner & Unit Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Tên chủ hộ</label>
                                <input type="text" name="OwnerName" value={formData.owner.OwnerName} onChange={handleOwnerChange} disabled={!isEditing} className={formElementStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Số điện thoại</label>
                                <input type="text" name="Phone" value={formData.owner.Phone} onChange={handleOwnerChange} disabled={!isEditing} className={formElementStyle} />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Email</label>
                                <input type="email" name="Email" value={formData.owner.Email} onChange={handleOwnerChange} disabled={!isEditing} className={formElementStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Trạng thái căn hộ</label>
                                <select name="Status" value={formData.Status} onChange={handleUnitChange} disabled={!isEditing} className={formElementStyle}>
                                    <option value="Owner">Chính chủ</option>
                                    <option value="Rent">Cho thuê</option>
                                    <option value="Business">Kinh doanh</option>
                                </select>
                            </div>
                        </div>

                        {/* Vehicle Info */}
                        <div className="mt-4">
                             <h4 className="font-semibold text-text-primary dark:text-dark-text-primary mb-2">Danh sách phương tiện</h4>
                             <div className="space-y-2">
                                {formData.vehicles.map((vehicle, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-2 bg-gray-50 dark:bg-dark-background rounded-md">
                                        {/* FIX: Corrected property access from 'tier' to 'Type' and updated 'name' attribute. */}
                                        <select name="Type" value={vehicle.Type} onChange={e => handleVehicleChange(index, e)} disabled={!isEditing} className={formElementStyle}>
                                            <option value={VehicleTier.CAR}>Ô tô thường</option>
                                            <option value={VehicleTier.CAR_A}>Ô tô nhỏ</option>
                                            <option value={VehicleTier.MOTORBIKE}>Xe máy</option>
                                            <option value={VehicleTier.BICYCLE}>Xe đạp</option>
                                        </select>
                                        {/* FIX: Corrected property access from 'LicensePlate' to 'PlateNumber' and updated 'name' attribute. */}
                                        <input type="text" name="PlateNumber" placeholder="Biển số" value={vehicle.PlateNumber} onChange={e => handleVehicleChange(index, e)} disabled={!isEditing} className={formElementStyle} />
                                        {/* FIX: Corrected property access from 'ActiveFrom' to 'StartDate' and updated 'name' attribute. */}
                                        <input type="date" name="StartDate" value={vehicle.StartDate} onChange={e => handleVehicleChange(index, e)} disabled={!isEditing} className={formElementStyle} />
                                        {isEditing && <button type="button" onClick={() => handleRemoveVehicle(index)} className="text-red-500 hover:text-red-700 font-semibold">Xóa</button>}
                                    </div>
                                ))}
                             </div>
                             {isEditing && <button type="button" onClick={handleAddVehicle} className="mt-2 text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">+ Thêm xe</button>}
                        </div>
                    </div>
                    
                    {isEditing && (
                        <div className="p-4 bg-gray-50 dark:bg-dark-secondary/50 flex justify-end gap-3 mt-auto">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-text-primary dark:text-dark-text-primary">
                                Hủy
                            </button>
                            <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-dark">
                                Lưu thay đổi
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};


const ResidentManagement: React.FC = () => {
    const { role } = useAuth();
    // FIX: The `useNotification` hook returns `showToast`, not `showNotification`. Aliasing to match usage in the component.
    const { showToast: showNotification } = useNotification();
    const canEdit = ['Admin', 'Operator', 'Accountant'].includes(role);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [units, setUnits] = useState<Unit[]>(MOCK_UNITS);
    const [owners, setOwners] = useState<Owner[]>(MOCK_OWNERS);
    const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
    const [searchTerm, setSearchTerm] = useState('');
    const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | UnitType>('all');
    
    const [modalState, setModalState] = useState<{ isOpen: boolean; resident: ResidentData | null; mode: 'view' | 'edit' }>({
        isOpen: false,
        resident: null,
        mode: 'view'
    });

    const residentData: ResidentData[] = useMemo(() => units.map(unit => {
        const owner = owners.find(o => o.OwnerID === unit.OwnerID);
        const unitVehicles = vehicles.filter(v => v.UnitID === unit.UnitID);
        return {
            ...unit,
            owner: owner!, // Assume owner always exists for a unit
            vehicles: unitVehicles,
        };
    }), [units, owners, vehicles]);

    const filteredResidents = useMemo(() => {
        return residentData.filter(res => {
            if (unitTypeFilter !== 'all' && res.UnitType !== unitTypeFilter) {
                return false;
            }
            if (searchTerm && !res.UnitID.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            return true;
        });
    }, [residentData, searchTerm, unitTypeFilter]);
    
    const handleOpenModal = (resident: ResidentData, mode: 'view' | 'edit') => {
        if (mode === 'edit' && !canEdit) {
            showNotification('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
        setModalState({ isOpen: true, resident, mode });
    };

    const handleCloseModal = () => {
        setModalState({ isOpen: false, resident: null, mode: 'view' });
    };

    const handleSaveResident = (updatedData: ResidentData) => {
        // Update units state
        setUnits(prev => prev.map(u => u.UnitID === updatedData.UnitID ? { ...u, Status: updatedData.Status } : u));
        // Update owners state
        setOwners(prev => prev.map(o => o.OwnerID === updatedData.owner.OwnerID ? updatedData.owner : o));
        // Update vehicles state
        setVehicles(prev => {
            const otherUnitVehicles = prev.filter(v => v.UnitID !== updatedData.UnitID);
            return [...otherUnitVehicles, ...updatedData.vehicles];
        });
        
        showNotification('Thông tin cư dân đã được cập nhật!', 'success');
        handleCloseModal();
    };
    
    const handleExportTemplate = () => {
        const headers = "UnitID,OwnerName,Phone,Email,Status\n";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "mau_nhap_lieu_cu_dan.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const headers = lines[0].trim().split(',').map(h => h.trim());
                // Basic validation
                if (headers[0] !== 'UnitID' || headers[1] !== 'OwnerName' || headers[2] !== 'Phone' || headers[3] !== 'Email' || headers[4] !== 'Status') {
                    throw new Error("Cột trong file CSV không hợp lệ. Vui lòng sử dụng file mẫu.");
                }

                let updatedCount = 0;
                let skippedCount = 0;

                const newUnits = [...units];
                const newOwners = [...owners];

                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i].trim().split(',');
                    const unitId = data[0]?.trim();
                    const ownerName = data[1]?.trim();
                    const phone = data[2]?.trim();
                    const email = data[3]?.trim();
                    const status = data[4]?.trim() as Unit['Status'];

                    if (!unitId || !ownerName) {
                        skippedCount++;
                        continue;
                    }

                    const unitIndex = newUnits.findIndex(u => u.UnitID === unitId);
                    if (unitIndex !== -1) {
                        newUnits[unitIndex].Status = status;
                        
                        const ownerId = newUnits[unitIndex].OwnerID;
                        const ownerIndex = newOwners.findIndex(o => o.OwnerID === ownerId);
                        
                        if (ownerIndex !== -1) {
                            newOwners[ownerIndex] = { ...newOwners[ownerIndex], OwnerName: ownerName, Phone: phone, Email: email };
                            updatedCount++;
                        } else {
                           skippedCount++;
                        }
                    } else {
                        skippedCount++;
                    }
                }
                
                setUnits(newUnits);
                setOwners(newOwners);
                showNotification(`Hoàn tất! Đã cập nhật ${updatedCount} cư dân. Bỏ qua ${skippedCount} dòng không hợp lệ.`, 'success');

            } catch (error: any) {
                showNotification(`Lỗi xử lý file: ${error.message}`, 'error');
            } finally {
                // Reset file input
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-background dark:bg-dark-secondary p-4 sm:p-6 rounded-lg shadow-md">
             {modalState.isOpen && modalState.resident && (
                <ResidentDetailModal 
                    resident={modalState.resident}
                    mode={modalState.mode}
                    onClose={handleCloseModal}
                    onSave={handleSaveResident}
                />
            )}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary">Quản lý Cư dân</h2>
                 <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv"
                        className="hidden"
                    />
                    <button onClick={handleImportClick} disabled={!canEdit} className="px-4 py-2 text-sm bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400">
                        Nhập CSV
                    </button>
                    <button onClick={handleExportTemplate} className="px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700">
                        Xuất mẫu
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-dark-secondary/50 rounded-lg border dark:border-dark-border-color">
                <div className="flex-grow">
                    <label htmlFor="search-unit" className="sr-only">Tìm căn hộ</label>
                    <input
                        id="search-unit"
                        type="text"
                        placeholder="Tìm theo mã căn hộ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-dark-background dark:border-dark-border-color"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary">Lọc theo loại:</span>
                    <button onClick={() => setUnitTypeFilter('all')} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>Tất cả</button>
                    <button onClick={() => setUnitTypeFilter(UnitType.APARTMENT)} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === UnitType.APARTMENT ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>{UnitType.APARTMENT}</button>
                    <button onClick={() => setUnitTypeFilter(UnitType.KIOS)} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${unitTypeFilter === UnitType.KIOS ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}>{UnitType.KIOS}</button>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
                    <thead className="bg-gray-50 dark:bg-dark-secondary">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Căn hộ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Chủ hộ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Thông tin liên hệ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Xe đăng ký</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary dark:text-dark-text-secondary">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
                        {filteredResidents.length === 0 ? (
                             <tr>
                                <td colSpan={5} className="text-center py-8 text-text-secondary dark:text-dark-text-secondary">
                                    Không tìm thấy dữ liệu phù hợp.
                                </td>
                            </tr>
                        ) : (
                            filteredResidents.map(res => (
                            <tr key={res.UnitID}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-text-primary dark:text-dark-text-primary">{res.UnitID}</div>
                                    <div className="text-sm text-text-secondary dark:text-dark-text-secondary">{res.Status} - {res.Area_m2} m²</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary dark:text-dark-text-primary">{res.owner?.OwnerName || 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-text-secondary dark:text-dark-text-secondary">
                                    <div>{res.owner?.Phone || 'N/A'}</div>
                                    <div>{res.owner?.Email || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-text-primary dark:text-dark-text-primary">
                                    {res.vehicles.length > 0 ? `${res.vehicles.length} xe` : 'Không có'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                    <button onClick={() => handleOpenModal(res, 'view')} className="text-primary hover:text-primary-dark">Xem</button>
                                    <button onClick={() => handleOpenModal(res, 'edit')} disabled={!canEdit} className="text-primary hover:text-primary-dark disabled:text-gray-400">Sửa</button>
                                </td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResidentManagement;