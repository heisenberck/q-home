
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Unit, Owner, Vehicle, Role, UserPermission, VehicleDocument, ActivityLog } from '../../types';
import { UnitType, VehicleTier } from '../../types';
import { useNotification } from '../../App';
import Modal from '../ui/Modal';
import StatCard from '../ui/StatCard';
import { 
    PencilSquareIcon, BuildingIcon, UploadIcon, UserGroupIcon, 
    UserIcon, KeyIcon, StoreIcon, CarIcon, TrashIcon,
    DocumentTextIcon, SearchIcon, ChevronDownIcon,
    MotorbikeIcon, BikeIcon, PhoneArrowUpRightIcon, ChatBubbleLeftEllipsisIcon, EnvelopeIcon, UserCircleIcon, ClipboardIcon,
    PrinterIcon, HomeIcon, WarningIcon, ClipboardDocumentListIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, EBikeIcon, EyeIcon, DocumentPlusIcon,
    PaperclipIcon, XMarkIcon,
    DocumentArrowDownIcon
} from '../ui/Icons';
import { normalizePhoneNumber, formatLicensePlate, vehicleTypeLabels, translateVehicleType, sortUnitsComparator, compressImageToWebP, parseUnitCode, getPastelColorForName, timeAgo } from '../../utils/helpers';
import { mapExcelHeaders } from '../../utils/importHelpers';
import { loadScript } from '../../utils/scriptLoader';

// Declare external libraries
declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any; // SheetJS


const StatusBadge: React.FC<{ status: 'Owner' | 'Rent' | 'Business' | string }> = ({ status }) => {
    const styles: Record<string, { icon: React.ReactElement; text: string; classes: string }> = {
        Owner: { icon: <UserIcon />, text: 'Chính chủ', classes: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
        Rent: { icon: <KeyIcon />, text: 'Hộ thuê', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
        Business: { icon: <StoreIcon />, text: 'Kinh doanh', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' }
    };
    const s = styles[status] || { icon: <UserIcon/>, text: 'Chưa rõ', classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${s.classes}`}>
            {React.cloneElement(s.icon, {className: "w-4 h-4"})}
            {s.text}
        </span>
    );
};


const renderStatusTooltip = (status: 'Owner' | 'Rent' | 'Business' | string) => {
     switch (status) {
        case 'Owner': return 'Chính chủ';
        case 'Rent': return 'Hộ thuê';
        case 'Business': return 'Kinh doanh';
        default: return 'Chưa rõ';
    }
}

type ResidentData = {
    unit: Unit;
    owner: Owner;
    vehicles: Vehicle[];
};

interface ResidentsPageProps {
    units: Unit[];
    owners: Owner[];
    vehicles: Vehicle[];
    activityLogs: ActivityLog[];
    onSaveResident: (data: { unit: Unit, owner: Owner, vehicles: Vehicle[] }, reason: string) => Promise<void>;
    onImportData: (updates: any[]) => void;
    onDeleteResidents: (unitIds: Set<string>) => void;
    role: Role;
    currentUser: UserPermission;
}

type VehicleErrors = {
    plateNumber?: string;
};

// --- START: PDF Generation Helper ---
const renderResidentToHTML = (resident: ResidentData): string => {
    const getTypeDisplay = (status: 'Owner' | 'Rent' | 'Business') => {
        switch (status) {
            case 'Owner': return 'Chính chủ';
            case 'Rent': return 'Hộ thuê';
            case 'Business': return 'Kinh doanh';
        }
    };
    const activeVehicles = resident.vehicles.filter(v => v.isActive);

    const vehicleRows = activeVehicles.length > 0
        ? activeVehicles.map(v => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #000 !important;">${translateVehicleType(v.Type)}</td>
                <td style="padding: 8px; color: #000 !important;">${v.VehicleName || ''}</td>
                <td style="padding: 8px; font-family: monospace; color: #000 !important;">${v.PlateNumber}</td>
                <td style="padding: 8px; color: #000 !important;">${v.parkingStatus || ''}</td>
                <td style="padding: 8px; color: #000 !important;">${new Date(v.StartDate).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding: 12px; font-style: italic; color: #777; text-align: center;">Chưa đăng ký phương tiện nào.</td></tr>';
    
    return `
    <div style="font-family: 'Inter', Arial, sans-serif; color: #1f2937; padding: 40px; background-color: white; max-width: 210mm; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px;">
            <h2 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 8px 0; text-transform: uppercase;">HỒ SƠ CƯ DÂN</h2>
            <p style="font-size: 16px; color: #6b7280; margin: 0;">Căn hộ: <span style="font-weight: 600; color: #374151;">${resident.unit.UnitID}</span></p>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Chủ hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Họ và tên:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.OwnerName}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Số điện thoại:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.Phone}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Email:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.Email}</td>
                </tr>
                 <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">Vợ/Chồng:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.secondOwnerName || 'Chưa có'}</td>
                </tr>
                 <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 500;">SĐT Vợ/Chồng:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.owner.secondOwnerPhone || ''}</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Thông tin Căn hộ</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                 <tr>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500;">Diện tích:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${resident.unit.Area_m2} m²</td>
                    <td style="padding: 6px 0; width: 140px; color: #6b7280; font-weight: 500; padding-left: 24px;">Trạng thái:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #000 !important;">${getTypeDisplay(resident.unit.Status)}</td>
                </tr>
            </table>
        </div>
        
        <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #006f3a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px;">Danh sách Phương tiện (${activeVehicles.length})</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e5e7eb;">
                <thead style="background-color: #f9fafb;">
                    <tr>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Loại xe</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Tên xe</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Biển số</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Trạng thái đỗ</th>
                        <th style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; color: #4b5563; font-weight: 600;">Ngày ĐK</th>
                    </tr>
                </thead>
                <tbody>${vehicleRows}</tbody>
            </table>
        </div>
    </div>
    `;
};
// --- END: PDF Generation Helper ---

const DocumentPreviewModal: React.FC<{
    doc: VehicleDocument;
    onClose: () => void;
}> = ({ doc, onClose }) => {
    const isImage = doc.type.startsWith('image/');
    // For PDFs embedded as base64 data URLs
    const isPdf = doc.type === 'application/pdf' || doc.url.startsWith('data:application/pdf');

    return (
        <Modal title={`Xem tài liệu: ${doc.name}`} onClose={onClose} size="4xl">
            <div className="flex justify-center items-center p-4 bg-gray-100 dark:bg-gray-900 min-h-[70vh]">
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


const ReasonModal: React.FC<{ onConfirm: (reason: string) => void; onCancel: () => void; }> = ({ onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleConfirm = () => {
        if (reason.trim()) {
            onConfirm(reason.trim());
        }
    };

    return (
        <Modal title="Xác nhận thay đổi" onClose={onCancel} size="md">
            <div className="space-y-4">
                <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nhập lý do thay đổi (Bắt buộc)</label>
                    <textarea
                        id="reason"
                        ref={inputRef}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        className="w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="VD: Cập nhật SĐT mới cho chủ hộ, thêm xe mới,..."
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button>
                    <button type="button" onClick={handleConfirm} disabled={!reason.trim()} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400">Xác nhận</button>
                </div>
            </div>
        </Modal>
    );
};


// --- Resident Detail/Edit Modal (View & Edit) ---
const ResidentDetailModal: React.FC<{
    resident: ResidentData;
    onClose: () => void;
    onSave: (updatedData: { unit: Unit, owner: Owner, vehicles: Vehicle[] }, reason: string) => Promise<void>;
}> = ({ resident, onClose, onSave }) => {
    const { showToast } = useNotification();
    
    const [formData, setFormData] = useState<{unit: Unit, owner: Owner, vehicles: Vehicle[]}>({
        unit: resident.unit,
        owner: {
            ...resident.owner,
            documents: resident.owner.documents || { others: [] }
        },
        vehicles: JSON.parse(JSON.stringify(resident.vehicles.filter(v => v.isActive)))
    });
    const [errors, setErrors] = useState<Record<number, VehicleErrors>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [reasonModalOpen, setReasonModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const vehicleLimits = useMemo(() => {
        const isOwner = formData.unit.Status === 'Owner';
        const isRenter = formData.unit.Status === 'Rent';

        const carCount = formData.vehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
        const motorbikeCount = formData.vehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;

        const canAddCar = !isRenter && (!isOwner || carCount < 1);

        return {
            isOwner,
            isRenter,
            carCount,
            motorbikeCount,
            canAddCar,
            showMotorbikeWarning: isOwner && motorbikeCount > 5,
        };
    }, [formData.unit.Status, formData.vehicles]);


    const formElementStyle = `w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed`;

    const validateVehicle = useCallback((vehicle: Vehicle): VehicleErrors => {
        const vErrors: VehicleErrors = {};
        const isBicycle = vehicle.Type === VehicleTier.BICYCLE;
        const plate = vehicle.PlateNumber?.trim() || '';
        
        if (!isBicycle && !plate) {
            vErrors.plateNumber = "Biển số là bắt buộc.";
        }
        return vErrors;
    }, []);
    
    useEffect(() => {
        const allErrors: Record<number, VehicleErrors> = {};
        formData.vehicles.forEach((v, index) => {
            const vErrors = validateVehicle(v);
            if (Object.keys(vErrors).length > 0) allErrors[index] = vErrors;
        });
        setErrors(allErrors);
    }, [formData.vehicles, validateVehicle]);
    
    const handleOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, owner: { ...p.owner, [e.target.name]: e.target.value } }));
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData(p => ({ ...p, unit: { ...p.unit, [e.target.name]: e.target.value as any }}));
    const handleVehicleChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index] = { ...updatedVehicles[index], [name]: value as any };

        if (name === 'Type' && value === VehicleTier.BICYCLE) {
            updatedVehicles[index].PlateNumber = ''; 
        }

        setFormData(p => ({ ...p, vehicles: updatedVehicles }));
    };

    const handleLicensePlateBlur = (index: number, e: React.FocusEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const formattedPlate = formatLicensePlate(value);
        const updatedVehicles = [...formData.vehicles];
        updatedVehicles[index].PlateNumber = formattedPlate;
        setFormData(p => ({ ...p, vehicles: updatedVehicles }));
    };

    const handleAddVehicle = () => {
        const newVehicle: Vehicle = {
            VehicleId: `VEH_NEW_${Date.now()}`,
            UnitID: formData.unit.UnitID,
            Type: VehicleTier.MOTORBIKE,
            VehicleName: '',
            PlateNumber: '',
            StartDate: new Date().toISOString().split('T')[0],
            isActive: true,
        };
        setFormData(p => ({...p, vehicles: [...p.vehicles, newVehicle]}));
    };
    
    const handleRemoveVehicle = (index: number) => setFormData(p => ({ ...p, vehicles: p.vehicles.filter((_, i) => i !== index) }));
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (Object.keys(errors).length > 0) {
            showToast('Vui lòng sửa các lỗi trong biểu mẫu trước khi lưu.', 'error');
            return;
        }
        setReasonModalOpen(true);
    };

    const handleConfirmSave = async (reason: string) => {
        setReasonModalOpen(false);
        setIsSaving(true);
        try {
            await onSave(formData, reason);
            onClose(); 
        } catch (error) {
            // Error toast is shown in the parent `handleSaveResident` function.
        } finally {
            setIsSaving(false);
        }
    };

    const handleOwnerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'nationalId' | 'title') => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showToast('Kích thước ảnh gốc phải nhỏ hơn 10MB.', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('Chỉ chấp nhận file ảnh.', 'error');
            return;
        }
    
        try {
            showToast('Đang nén ảnh...', 'info');
            const compressedDataUrl = await compressImageToWebP(file);
            const newDoc: VehicleDocument = { // Reusing VehicleDocument type
                fileId: `DOC_OWNER_${Date.now()}`,
                name: file.name.replace(/\.[^/.]+$/, ".webp"),
                url: compressedDataUrl,
                type: 'image/webp',
                uploadedAt: new Date().toISOString()
            };
            
            setFormData(prev => ({ ...prev, owner: { ...prev.owner, documents: { ...prev.owner.documents, [docType]: newDoc } } }));
            showToast(`Đã tải lên ${newDoc.name}`, 'success');
        } catch (error) {
            showToast('Lỗi khi nén và xử lý ảnh.', 'error');
        }
        if(e.target) e.target.value = '';
    };

    const handleRemoveOwnerFile = (docType: 'nationalId' | 'title') => {
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
            setFormData(prev => {
                const newDocs = { ...prev.owner.documents };
                delete newDocs[docType];
                return { ...prev, owner: { ...prev.owner, documents: newDocs } };
            });
        }
    };
    
    const handleConfirmUploadOtherFile = (fileName: string, file: File) => {
        const currentDocs = formData.owner.documents || {};
        const currentFileCount = (currentDocs.nationalId ? 1 : 0) + (currentDocs.title ? 1 : 0) + (currentDocs.others?.length || 0);
        if (currentFileCount >= 8) {
            showToast('Đã đạt giới hạn 8 file cho mỗi căn hộ.', 'error');
            return;
        }

        try {
            showToast('Đang xử lý file...', 'info');
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const newDoc: VehicleDocument = {
                    fileId: `DOC_OTHER_${Date.now()}`,
                    name: fileName,
                    url: reader.result as string,
                    type: file.type,
                    uploadedAt: new Date().toISOString()
                };
                setFormData(prev => ({
                    ...prev,
                    owner: {
                        ...prev.owner,
                        documents: {
                            ...prev.owner.documents,
                            others: [...(prev.owner.documents?.others || []), newDoc]
                        }
                    }
                }));
                showToast(`Đã tải lên file: ${fileName}`, 'success');
            };
            reader.onerror = () => { throw new Error("File reading failed"); };
        } catch (error) {
            showToast('Lỗi khi xử lý file.', 'error');
        } finally {
            setIsUploadModalOpen(false);
        }
    };

    const handleRemoveOtherFile = (fileId: string) => {
        if (window.confirm('Bạn có chắc