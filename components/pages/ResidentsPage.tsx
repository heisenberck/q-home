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
// FIX: Add missing import for loadScript utility
import { loadScript } from '../../utils/scriptLoader';

// Declare external libraries
declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any; // SheetJS


const StatusBadge: React.FC<{ status: 'Owner' | 'Rent' | 'Business' | string }> = ({ status }) => {
    // FIX: Change icon type from React.ReactNode to React.ReactElement to allow cloning with new props.
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
        if (window.confirm('Bạn có chắc muốn xóa file này?')) {
            setFormData(prev => ({
                ...prev,
                owner: {
                    ...prev.owner,
                    documents: {
                        ...prev.owner.documents,
                        others: prev.owner.documents?.others?.filter(doc => doc.fileId !== fileId) || []
                    }
                }
            }));
        }
    };


    const FileUploadField: React.FC<{ docType: 'nationalId' | 'title'; label: string; }> = ({ docType, label }) => {
        const doc = formData.owner.documents?.[docType];
        return (
            <div className="border dark:border-dark-border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{label}</label>
                    {doc ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 truncate max-w-[150px]">{doc.name}</span>
                            <button type="button" onClick={() => handleRemoveOwnerFile(docType)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <label className="cursor-pointer text-xs bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50">
                            <span className="flex items-center gap-1"><UploadIcon className="w-3 h-3"/> Upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleOwnerFileUpload(e, docType)} />
                        </label>
                    )}
                </div>
            </div>
        );
    };

    const UploadFileModal: React.FC<{ onConfirm: (name: string, file: File) => void; onCancel: () => void; }> = ({ onConfirm, onCancel }) => {
        const [fileName, setFileName] = useState('');
        const [file, setFile] = useState<File | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        useEffect(() => { if (file) setFileName(file.name); }, [file]);
        
        const handleConfirm = () => { if (fileName.trim() && file) onConfirm(fileName.trim(), file); };

        return (
            <Modal title="Upload File Khác" onClose={onCancel} size="md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên hiển thị cho file</label>
                        <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} className={formElementStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chọn file</label>
                        <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-dark-border">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button>
                        <button type="button" onClick={handleConfirm} disabled={!fileName.trim() || !file} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400">Xác nhận</button>
                    </div>
                </div>
            </Modal>
        );
    };

    return (
        <Modal title={`Sửa thông tin - Căn hộ ${resident.unit.UnitID}`} onClose={onClose} size="3xl">
            {reasonModalOpen && <ReasonModal onConfirm={handleConfirmSave} onCancel={() => setReasonModalOpen(false)} />}
            {isUploadModalOpen && <UploadFileModal onConfirm={handleConfirmUploadOtherFile} onCancel={() => setIsUploadModalOpen(false)} />}

            <form onSubmit={handleSubmit} className="space-y-6">
                <section>
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4">Thông tin cư dân</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="font-medium text-sm">Tên chủ hộ</label><input name="OwnerName" value={formData.owner.OwnerName} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div><label className="font-medium text-sm">SĐT chủ hộ</label><input name="Phone" value={formData.owner.Phone} onChange={handleOwnerChange} className={formElementStyle} /></div>
                         <div><label className="font-medium text-sm">Tên Vợ/Chồng</label><input name="secondOwnerName" value={formData.owner.secondOwnerName || ''} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div><label className="font-medium text-sm">SĐT Vợ/Chồng</label><input name="secondOwnerPhone" value={formData.owner.secondOwnerPhone || ''} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div className="md:col-span-2"><label className="font-medium text-sm">Email</label><input type="email" name="Email" value={formData.owner.Email} onChange={handleOwnerChange} className={formElementStyle} /></div>
                        <div>
                            <label className="font-medium text-sm">Trạng thái căn hộ</label>
                            <select name="Status" value={formData.unit.Status} onChange={handleUnitChange} className={formElementStyle}>
                                <option value="Owner">Chính chủ</option><option value="Rent">Hộ thuê</option><option value="Business">Kinh doanh</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5"/> Hồ sơ, Tài liệu
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FileUploadField docType="nationalId" label="Ảnh CCCD" />
                        <FileUploadField docType="title" label="Ảnh Sổ đỏ/Hợp đồng" />
                    </div>
                     <div className="mt-4 space-y-2">
                        {(formData.owner.documents?.others || []).map(doc => (
                             <div key={doc.fileId} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm">
                                <span className="font-medium truncate">{doc.name}</span>
                                <button type="button" onClick={() => handleRemoveOtherFile(doc.fileId)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4"/></button>
                             </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <button type="button" onClick={() => setIsUploadModalOpen(true)} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                            <DocumentPlusIcon /> Upload file khác...
                        </button>
                    </div>
                     <p className="text-xs text-gray-500 mt-2">Tối đa 8 file/căn hộ. File ảnh sẽ được nén, các loại file khác sẽ giữ nguyên.</p>
                </section>
                
                <section>
                    <h3 className="text-lg font-medium border-b dark:border-dark-border pb-2 mb-4">Phương tiện</h3>
                    {vehicleLimits.showMotorbikeWarning && (
                        <div className="p-3 mb-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-r-md">
                            <p className="font-bold">Cảnh báo: Hộ chính chủ đã đăng ký quá 5 xe máy.</p>
                        </div>
                    )}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {formData.vehicles.map((vehicle, index) => (
                            <div key={vehicle.VehicleId || index} className="grid grid-cols-1 md:grid-cols-10 gap-2 items-start p-2 bg-light-bg dark:bg-dark-bg rounded-md border dark:border-dark-border">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold">Loại xe</label>
                                    <select name="Type" value={vehicle.Type === VehicleTier.EBIKE ? VehicleTier.MOTORBIKE : vehicle.Type} onChange={e => handleVehicleChange(index, e)} className={formElementStyle}>
                                        <option value={VehicleTier.CAR} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR}>{vehicleTypeLabels.car}</option>
                                        <option value={VehicleTier.CAR_A} disabled={!vehicleLimits.canAddCar && vehicle.Type !== VehicleTier.CAR_A}>{vehicleTypeLabels.car_a}</option>
                                        <option value={VehicleTier.MOTORBIKE}>{vehicleTypeLabels.motorbike}</option>
                                        <option value={VehicleTier.BICYCLE}>{vehicleTypeLabels.bicycle}</option>
                                    </select>
                                </div>
                                <div className="md:col-span-3"><label className="text-xs font-semibold">Tên xe</label><input type="text" name="VehicleName" placeholder={vehicle.Type.includes('car') ? 'Toyota Vios...' : 'Honda SH...'} value={vehicle.VehicleName || ''} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                <div className="md:col-span-2"><label className="text-xs font-semibold">Biển số</label><input type="text" name="PlateNumber" placeholder={vehicle.Type.includes('car') ? 'VD: 30E-12345' : 'VD: 29H1-12345'} value={vehicle.PlateNumber} onBlur={(e) => handleLicensePlateBlur(index, e)} onChange={e => handleVehicleChange(index, e)} className={`${formElementStyle} ${errors[index]?.plateNumber ? 'border-red-500' : ''}`} /><p className="text-red-500 text-xs mt-1 h-3">{errors[index]?.plateNumber}</p></div>
                                <div className="md:col-span-2"><label className="text-xs font-semibold">Ngày ĐK</label><input type="date" name="StartDate" value={vehicle.StartDate} onChange={e => handleVehicleChange(index, e)} className={formElementStyle} /></div>
                                <div className="md:col-span-1 text-center self-center pt-5"><button type="button" onClick={() => handleRemoveVehicle(index)} className="text-red-500 hover:underline font-semibold">Xóa</button></div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddVehicle} className="mt-4 px-3 py-1 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-focus">+ Thêm xe</button>
                </section>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-dark-border"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button><button type="submit" disabled={isSaving || Object.keys(errors).length > 0} className="px-4 py-2 bg-primary text-white rounded-md disabled:bg-gray-400">{isSaving ? 'Đang lưu...' : 'Lưu'}</button></div>
            </form>
        </Modal>
    );
};

const DataImportModal: React.FC<{
    onClose: () => void;
    onImport: (updates: any[]) => void;
}> = ({ onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [mappedHeaders, setMappedHeaders] = useState<Record<string, string>>({});
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const { showToast } = useNotification();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (json.length > 0) {
                    const headers = json[0].map((h: any) => String(h).trim());
                    setRawHeaders(headers);
                    setMappedHeaders(mapExcelHeaders(headers));
                    setPreview(json.slice(1).filter(row => row.some((cell: any) => cell !== "")));
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    };

    const processExcelData = () => {
        if (!preview.length || !Object.keys(mappedHeaders).length) {
            showToast("Không có dữ liệu hợp lệ để xử lý.", "warn");
            return;
        }

        const updates = preview.map(rowArray => {
            const row: { [key: string]: any } = {};
            rawHeaders.forEach((header, index) => {
                const mappedKey = mappedHeaders[header];
                if (mappedKey) {
                    row[mappedKey] = rowArray[index];
                }
            });

            const unitId = row.unitId;
            if (!unitId) return null;

            const unitIdStr = String(unitId).trim();
            const unitType = unitIdStr.toLowerCase().startsWith('kios') ? UnitType.KIOS : UnitType.APARTMENT;

            const vehicles: any[] = [];
            
            if (row.vehicles_motorbike) String(row.vehicles_motorbike).split(';').forEach(plate => { if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.MOTORBIKE, VehicleName: '' }); });
            if (row.vehicles_ebike) String(row.vehicles_ebike).split(';').forEach(plate => { if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.EBIKE, VehicleName: '' }); });
            if (row.vehicles_bicycle) String(row.vehicles_bicycle).split(';').forEach(plate => { if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.BICYCLE, VehicleName: '' }); });
            if (row.vehicles_car) String(row.vehicles_car).split(';').forEach(plate => { if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.CAR, VehicleName: '' }); });
            if (row.vehicles_car_a) String(row.vehicles_car_a).split(';').forEach(plate => { if (plate.trim()) vehicles.push({ PlateNumber: plate.trim(), Type: VehicleTier.CAR_A, VehicleName: '' }); });

            return {
                unitId: unitIdStr,
                unitType: unitType,
                ownerName: String(row.ownerName || ''),
                status: row.status || 'Owner',
                area: parseFloat(String(row.area || '0').replace(/m2/i, '').trim()) || 0,
                phone: normalizePhoneNumber(row.phone || ''),
                email: String(row.email || ''),
                vehicles: vehicles,
                parkingStatus: row.parkingStatus || null,
            };

        }).filter(Boolean);

        onImport(updates);
        onClose();
    };

    return (
        <Modal title="Nhập dữ liệu Cư dân từ Excel" onClose={onClose} size="5xl">
            <div className="space-y-4">
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="mx-auto block text-sm" />
                </div>

                {preview.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2">Xem trước dữ liệu (10 dòng đầu)</h4>
                        <div className="overflow-auto border rounded-lg max-h-96">
                            <table className="min-w-full">
                                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        {rawHeaders.map((header, index) => (
                                            <th key={index} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {header}
                                                <div className="text-primary font-bold">{mappedHeaders[header] || <span className="text-red-500">Not Found</span>}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {preview.slice(0, 10).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            {rawHeaders.map((_header, colIndex) => (
                                                <td key={colIndex} className="px-4 py-3 text-sm whitespace-nowrap text-gray-800 dark:text-gray-200">
                                                    {row[colIndex] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-dark-border">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Hủy</button>
                    <button onClick={processExcelData} disabled={!preview.length} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus disabled:bg-gray-400">
                        Bắt đầu nhập
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const FilterPill: React.FC<{
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  currentValue: string;
  onValueChange: (value: string) => void;
  tooltip: string;
}> = ({ icon, options, currentValue, onValueChange, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentLabel = options.find(o => o.value === currentValue)?.label || 'Select';

    return (
        <div className="relative" ref={pillRef} data-tooltip={tooltip}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-10 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary rounded-lg flex items-center gap-2 hover:border-primary transition-colors w-full justify-between"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <div className='flex items-center gap-2'>
                    {icon}
                    <span className="text-sm font-medium">{currentLabel}</span>
                </div>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1.5 z-20 bg-light-bg-secondary dark:bg-dark-bg-secondary p-2 rounded-lg shadow-lg border dark:border-dark-border w-48 max-h-60 overflow-y-auto">
                    {options.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onValueChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-md text-sm ${currentValue === option.value ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Main Page Component ---
const ResidentsPage: React.FC<ResidentsPageProps> = ({ units, owners, vehicles, activityLogs, onSaveResident, onImportData, onDeleteResidents, role, currentUser }) => {
    const { showToast } = useNotification();
    const canManage = ['Admin', 'Accountant', 'Operator'].includes(role);
    const canDelete = role === 'Admin';
    
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Owner' | 'Rent' | 'Business'>('all');
    const [floorFilter, setFloorFilter] = useState('all');
    const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'Owner' | 'Rent' | 'Business'>('all');
    
    const [modalState, setModalState] = useState<{ type: 'edit' | 'import' | null; data: ResidentData | null }>({ type: null, data: null });
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);

    useEffect(() => {
        setSelectedResident(null);
    }, [searchTerm, typeFilter, statusFilter, floorFilter]);
    
    const residentsData = useMemo(() => {
        const ownersMap = new Map(owners.map(o => [o.OwnerID, o]));
        const vehiclesMap = new Map<string, Vehicle[]>();
        vehicles.forEach(v => {
            if (!vehiclesMap.has(v.UnitID)) vehiclesMap.set(v.UnitID, []);
            vehiclesMap.get(v.UnitID)!.push(v);
        });

        return units.map(unit => ({
            unit,
            owner: ownersMap.get(unit.OwnerID)!,
            vehicles: vehiclesMap.get(unit.UnitID) || [],
        })).sort((a,b) => sortUnitsComparator(a.unit, b.unit));
    }, [units, owners, vehicles]);

    const filteredResidents = useMemo(() => {
        return residentsData.filter(r => {
            if (typeFilter !== 'all' && r.unit.UnitType !== typeFilter) return false;
            if (statusFilter !== 'all' && r.unit.Status !== statusFilter) return false;
            
            if (floorFilter !== 'all') {
                if (floorFilter === 'KIOS') {
                    if (r.unit.UnitType !== UnitType.KIOS) return false;
                } else {
                    const unitFloor = parseUnitCode(r.unit.UnitID)?.floor;
                    if (String(unitFloor) !== floorFilter) return false;
                }
            }
            
            const s = searchTerm.toLowerCase();
            if (s && !(
                r.unit.UnitID.toLowerCase().includes(s) ||
                (r.owner.OwnerName || '').toLowerCase().includes(s) ||
                (r.owner.Phone || '').includes(s)
            )) return false;
            
            return true;
        });
    }, [residentsData, searchTerm, typeFilter, statusFilter, floorFilter]);

    const kpiStats = useMemo(() => {
        return {
            total: units.length,
            owner: units.filter(u => u.Status === 'Owner').length,
            rent: units.filter(u => u.Status === 'Rent').length,
            business: units.filter(u => u.Status === 'Business').length,
        }
    }, [units]);

    const floors = useMemo(() => {
        const floorNumbers = Array.from(new Set(units.filter(u=>u.UnitType === UnitType.APARTMENT).map(u => u.UnitID.slice(0,-2)))).sort((a,b) => parseInt(String(a), 10) - parseInt(String(b), 10));
        return [{value: 'all', label: 'All Floors'}, ...floorNumbers.map(f => ({value: f, label: `Floor ${f}`})), {value: 'KIOS', label: 'KIOS'}];
    }, [units]);

    const handleSelectResident = useCallback((resident: ResidentData) => {
        setSelectedResident(prev => prev?.unit.UnitID === resident.unit.UnitID ? null : resident);
    }, []);

    const handleOpenEditModal = (e: React.MouseEvent, resident: ResidentData) => {
        e.stopPropagation();
        if (!canManage) {
            showToast('Bạn không có quyền chỉnh sửa.', 'error');
            return;
        }
        setModalState({ type: 'edit', data: resident });
    };

    const handleCloseModal = () => setModalState({ type: null, data: null });
    
    const handleSaveResident = async (data: { unit: Unit; owner: Owner; vehicles: Vehicle[] }, reason: string) => {
        await onSaveResident(data, reason);
        handleCloseModal();
        if (selectedResident?.unit.UnitID === data.unit.UnitID) {
            const updatedResidentData = {
                ...data,
                vehicles: data.vehicles.filter(v => v.isActive)
            };
            setSelectedResident(updatedResidentData);
        }
    };
    
    const handleExportPDF = useCallback(async (resident: ResidentData) => {
        try {
            await Promise.all([loadScript('jspdf'), loadScript('html2canvas')]);
            const htmlContent = renderResidentToHTML(resident);
            
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; background:#fff; z-index:-1;';
            document.body.appendChild(host);
            host.innerHTML = htmlContent;
            
            await new Promise(r => setTimeout(r, 100)); // Wait for render
            
            const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false });
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            host.remove();
            
            pdf.save(`HoSoCuDan_${resident.unit.UnitID}.pdf`);
            showToast('Đã xuất PDF thành công!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            showToast('Lỗi khi xuất file PDF.', 'error');
        }
    }, []);
    
    const handleCopyToClipboard = (text: string | undefined | null, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Đã sao chép ${label}: ${text}`, 'success');
        }).catch(() => {
            showToast('Sao chép thất bại', 'error');
        });
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {modalState.type === 'edit' && modalState.data && <ResidentDetailModal resident={modalState.data} onClose={handleCloseModal} onSave={handleSaveResident} />}
            {modalState.type === 'import' && <DataImportModal onClose={handleCloseModal} onImport={onImportData} />}
            
            {/* Left Column: List and Filters */}
            <div className="w-2/3 flex flex-col gap-4 min-w-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="cursor-pointer" onClick={() => { setStatusFilter('all'); setActiveKpiFilter('all'); }}>
                        <StatCard label="Tổng số căn" value={kpiStats.total} icon={<BuildingIcon className="w-6 h-6 text-gray-600"/>} />
                    </div>
                    <div className="cursor-pointer" onClick={() => { setStatusFilter('Owner'); setActiveKpiFilter('Owner'); }}>
                        <StatCard label="Chính chủ" value={kpiStats.owner} icon={<UserIcon className="w-6 h-6 text-green-600"/>} />
                    </div>
                    <div className="cursor-pointer" onClick={() => { setStatusFilter('Rent'); setActiveKpiFilter('Rent'); }}>
                        <StatCard label="Hộ thuê" value={kpiStats.rent} icon={<KeyIcon className="w-6 h-6 text-blue-600"/>} />
                    </div>
                    <div className="cursor-pointer" onClick={() => { setStatusFilter('Business'); setActiveKpiFilter('Business'); }}>
                        <StatCard label="Kinh doanh" value={kpiStats.business} icon={<StoreIcon className="w-6 h-6 text-amber-600"/>} />
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-bg-secondary p-4 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative flex-grow min-w-[150px] md:min-w-[200px]"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Tìm căn hộ, tên, SĐT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"/></div>
                        <div className="hidden lg:block"><FilterPill icon={<BuildingIcon className="h-5 w-5 text-gray-400" />} currentValue={floorFilter} onValueChange={setFloorFilter} tooltip="Lọc theo tầng" options={floors} /></div>
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => setModalState({ type: 'import', data: null })} className="h-10 px-4 font-semibold rounded-lg flex items-center gap-2 border border-primary text-primary hover:bg-primary/10 bg-white dark:bg-transparent"><UploadIcon /> Import</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm flex-1 flex flex-col min-h-0">
                    <div className="overflow-y-auto pr-2">
                        <table className="min-w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Căn hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Chủ hộ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">SĐT</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Trạng thái</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Xe cộ</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredResidents.map(r => {
                                    const activeVehicles = r.vehicles.filter(v => v.isActive);
                                    const carCount = activeVehicles.filter(v => v.Type === VehicleTier.CAR || v.Type === VehicleTier.CAR_A).length;
                                    const motorbikeCount = activeVehicles.filter(v => v.Type === VehicleTier.MOTORBIKE || v.Type === VehicleTier.EBIKE).length;
                                    const bicycleCount = activeVehicles.filter(v => v.Type === VehicleTier.BICYCLE).length;
                                    const hasDocs = r.owner.documents?.nationalId || r.owner.documents?.title || (r.owner.documents?.others && r.owner.documents.others.length > 0);
                                    
                                    return (
                                        <tr key={r.unit.UnitID} onClick={() => handleSelectResident(r)} className={`cursor-pointer transition-colors ${selectedResident?.unit.UnitID === r.unit.UnitID ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                                            <td className="font-semibold px-4 py-4 text-sm text-gray-900 dark:text-gray-200">{r.unit.UnitID}</td>
                                            <td className="px-4 py-4 text-sm font-bold text-gray-900 dark:text-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <span>{r.owner.OwnerName}</span>
                                                    {hasDocs && <PaperclipIcon className="w-4 h-4 text-gray-400" data-tooltip="Có hồ sơ đính kèm"/>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">{r.owner.Phone}</td>
                                            <td className="text-center px-4 py-4"><StatusBadge status={r.unit.Status} /></td>
                                            <td className="px-4 py-4 text-sm text-center">
                                                <div className="flex justify-center items-center gap-3 text-gray-600 dark:text-gray-400">
                                                    {carCount > 0 && (
                                                        <div className="flex items-center gap-1" data-tooltip={`${carCount} ô tô`}>
                                                            <CarIcon className="w-5 h-5"/>
                                                            <span className="text-xs font-bold">{carCount}</span>
                                                        </div>
                                                    )}
                                                    {motorbikeCount > 0 && (
                                                        <div className="flex items-center gap-1" data-tooltip={`${motorbikeCount} xe máy/xe điện`}>
                                                            <MotorbikeIcon className="w-5 h-5"/>
                                                            <span className="text-xs font-bold">{motorbikeCount}</span>
                                                        </div>
                                                    )}
                                                    {bicycleCount > 0 && (
                                                        <div className="flex items-center gap-1" data-tooltip={`${bicycleCount} xe đạp`}>
                                                            <BikeIcon className="w-5 h-5"/>
                                                            <span className="text-xs font-bold">{bicycleCount}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4"><div className="flex justify-center items-center gap-2">
                                                <button onClick={(e) => handleOpenEditModal(e, r)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30" data-tooltip="Sửa hồ sơ"><PencilSquareIcon className="w-5 h-5 text-blue-500" /></button>
                                            </div></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Column: Detail View */}
            <div className="w-1/3 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm overflow-y-auto">
                {selectedResident ? <ResidentDetailPanel key={selectedResident.unit.UnitID} resident={selectedResident} activityLogs={activityLogs} onExportPDF={handleExportPDF} onCopyToClipboard={handleCopyToClipboard} onClose={() => setSelectedResident(null)} /> : <ResidentDashboard units={units} owners={owners} vehicles={vehicles} activityLogs={activityLogs} />}
            </div>
        </div>
    );
};


const ResidentDetailPanel: React.FC<{ 
    resident: ResidentData, 
    activityLogs: ActivityLog[],
    onExportPDF: (resident: ResidentData) => void, 
    onCopyToClipboard: (text: string | undefined | null, label: string) => void,
    onClose: () => void;
}> = ({ resident, activityLogs, onExportPDF, onCopyToClipboard, onClose }) => {
    const { unit, owner, vehicles } = resident;
    const { bg, text, border } = getPastelColorForName(owner.OwnerName);
    const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

    const vehicleSortOrder: Record<VehicleTier, number> = {
        [VehicleTier.CAR]: 1, [VehicleTier.CAR_A]: 2, [VehicleTier.MOTORBIKE]: 3,
        [VehicleTier.EBIKE]: 4, [VehicleTier.BICYCLE]: 5,
    };
    
    const activeVehicles = vehicles.filter(v => v.isActive).sort((a, b) => vehicleSortOrder[a.Type] - vehicleSortOrder[b.Type]);

    const combinedHistory = useMemo(() => {
        const historyLogs = activityLogs
            .filter(log => log.module === 'Residents' && log.ids?.includes(unit.UnitID))
            .map(log => ({ type: 'log', data: log, ts: log.ts }));

        const vehicleLogs = vehicles
            .filter(v => !v.isActive && v.updatedAt)
            .map(vehicle => ({ type: 'vehicle', data: vehicle, ts: vehicle.updatedAt! }));
            
        return [...historyLogs, ...vehicleLogs].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    }, [activityLogs, vehicles, unit.UnitID]);

    const allDocs = [
        ...(owner.documents?.nationalId ? [{...owner.documents.nationalId, name: `CCCD - ${owner.documents.nationalId.name}`}] : []),
        ...(owner.documents?.title ? [{...owner.documents.title, name: `Sổ đỏ/HĐ - ${owner.documents.title.name}`}] : []),
        ...(owner.documents?.others || [])
    ];
    
    return (
        <div className="flex flex-col">
            {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
            <div className={`p-4 rounded-t-xl ${bg} flex-shrink-0 relative`}>
                <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full bg-white/30 hover:bg-white/60" data-tooltip="Đóng">
                    <XMarkIcon className={`w-5 h-5 ${text}`} />
                </button>
                <header className="flex items-center gap-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center bg-white/50 border-4 ${border} flex-shrink-0`}>
                        <span className={`text-4xl font-bold ${text}`}>{owner.OwnerName.charAt(0)}</span>
                    </div>
                    <div className="flex-grow">
                        <h2 className={`text-2xl font-bold ${text}`}>{owner.OwnerName}</h2>
                        <div className="mt-1 px-3 py-1 bg-white/70 rounded-full text-sm font-semibold text-gray-800 inline-block">
                           {unit.UnitID} - {unit.Area_m2}m² - {renderStatusTooltip(unit.Status)}
                        </div>
                    </div>
                </header>
                <div className="flex items-center gap-3 mt-4 justify-start">
                    <button onClick={() => onCopyToClipboard(owner.Phone, 'số điện thoại')} className="p-2 rounded-full bg-white/50 hover:bg-white/80" data-tooltip="Gọi/Sao chép SĐT"><PhoneArrowUpRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" /></button>
                    <button onClick={() => { if (!owner.Phone) return; let zp = owner.Phone.startsWith('0') ? '84' + owner.Phone.substring(1) : owner.Phone; window.open(`https://zalo.me/${zp.replace(/\D/g, '')}`, '_blank');}} className="p-2 rounded-full bg-white/50 hover:bg-white/80" data-tooltip="Chat Zalo"><ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-gray-600 dark:text-gray-300"/></button>
                    <button onClick={() => window.open(`mailto:${owner.Email}`)} className="p-2 rounded-full bg-white/50 hover:bg-white/80" data-tooltip="Gửi Email"><EnvelopeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300"/></button>
                    <button onClick={() => onExportPDF(resident)} className="p-2 rounded-full bg-white/50 hover:bg-white/80" data-tooltip="In hồ sơ (PDF)"><PrinterIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" /></button>
                </div>
            </div>
            <div className="p-6 space-y-6">
                <div className="border-t dark:border-dark-border pt-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Thông tin liên hệ</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center group"><span className="text-gray-500 dark:text-gray-400">Chủ hộ:</span><div className="flex items-center gap-2"><span className="font-semibold text-gray-900 dark:text-gray-200">{owner.OwnerName}</span> <button onClick={() => onCopyToClipboard(owner.OwnerName, 'tên')} className="opacity-0 group-hover:opacity-100 transition-opacity"><ClipboardIcon className="w-4 h-4 text-gray-400"/></button></div></div>
                        <div className="flex justify-between items-center group"><span className="text-gray-500 dark:text-gray-400">SĐT:</span><div className="flex items-center gap-2"><span className="font-semibold text-gray-900 dark:text-gray-200 font-mono">{owner.Phone}</span> <button onClick={() => onCopyToClipboard(owner.Phone, 'SĐT')} className="opacity-0 group-hover:opacity-100 transition-opacity"><ClipboardIcon className="w-4 h-4 text-gray-400"/></button></div></div>
                        <div className="flex justify-between items-center group"><span className="text-gray-500 dark:text-gray-400">Email:</span><div className="flex items-center gap-2"><span className="font-semibold text-gray-900 dark:text-gray-200">{owner.Email || 'Chưa có'}</span> {owner.Email && <button onClick={() => onCopyToClipboard(owner.Email, 'email')} className="opacity-0 group-hover:opacity-100 transition-opacity"><ClipboardIcon className="w-4 h-4 text-gray-400"/></button>}</div></div>
                    </div>
                </div>

                <div className="border-t dark:border-dark-border pt-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Phương tiện đang hoạt động ({activeVehicles.length})</h3>
                    {activeVehicles.length > 0 ? (
                        <ul className="space-y-2">
                            {activeVehicles.map(v => (
                                <li key={v.VehicleId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-500">
                                            {v.Type.includes('car') ? <CarIcon/> : (v.Type === VehicleTier.MOTORBIKE ? <MotorbikeIcon/> : (v.Type === VehicleTier.EBIKE ? <EBikeIcon /> : <BikeIcon/>))}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900 dark:text-gray-200">{v.VehicleName}</p>
                                            <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{v.PlateNumber}</p>
                                        </div>
                                    </div>
                                    {v.parkingStatus && <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${v.parkingStatus === 'Lốt chính' ? 'bg-green-100 text-green-800' : (v.parkingStatus === 'Lốt tạm' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800')}`}>{v.parkingStatus}</span>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-center text-gray-500 py-4">Chưa có phương tiện nào đang hoạt động.</p>
                    )}
                </div>

                <div className="border-t dark:border-dark-border pt-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Hồ sơ, Tài liệu ({allDocs.length})</h3>
                     {allDocs.length > 0 ? (<ul className="space-y-2">{allDocs.map(doc => (<li key={doc.fileId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm"><div className="flex items-center gap-2 truncate"><DocumentTextIcon className="w-5 h-5 flex-shrink-0"/><span className="truncate">{doc.name}</span></div><button onClick={() => setPreviewDoc(doc)} className="text-blue-600 hover:underline text-xs font-semibold flex-shrink-0 flex items-center gap-1"><EyeIcon className="w-4 h-4"/>Xem</button></li>))}</ul>) 
                    : (<p className="text-sm text-center text-gray-500 py-4">Chưa có tài liệu đính kèm.</p>)}
                </div>

                 <div className="border-t dark:border-dark-border pt-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3">Lịch sử Căn hộ</h3>
                     {combinedHistory.length > 0 ? (
                        <ul className="space-y-4">
                            {combinedHistory.map(item => {
                                if (item.type === 'log') {
                                    const log = item.data as ActivityLog;
                                    return (
                                        <li key={`log-${log.id}`} className="flex items-start space-x-3">
                                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2 mt-1">
                                                <UserCircleIcon className="w-4 h-4 text-gray-500"/>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-800 dark:text-gray-200">{log.summary}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(log.ts)} bởi {log.actor_email.split('@')[0]}</p>
                                            </div>
                                        </li>
                                    );
                                }
                                if (item.type === 'vehicle') {
                                    const vehicle = item.data as Vehicle;
                                    return (
                                        <li key={`vehicle-${vehicle.VehicleId}`} className="flex items-start space-x-3">
                                            <div className="bg-red-50 dark:bg-red-900/30 rounded-full p-2 mt-1">
                                                <TrashIcon className="w-4 h-4 text-red-500"/>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                                    Đã hủy xe <strong>{vehicle.PlateNumber}</strong> ({translateVehicleType(vehicle.Type)})
                                                    {vehicle.log && <span className="text-gray-600 dark:text-gray-400"> - Lý do: {vehicle.log}</span>}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(vehicle.updatedAt)}</p>
                                            </div>
                                        </li>
                                    );
                                }
                                return null;
                            })}
                        </ul>
                     ) : (
                        <p className="text-sm text-center text-gray-500 py-4">Chưa có lịch sử thay đổi.</p>
                     )}
                </div>
            </div>
        </div>
    );
};

const ResidentDashboard: React.FC<{ units: Unit[], owners: Owner[], vehicles: Vehicle[], activityLogs: ActivityLog[] }> = ({ units, owners, vehicles, activityLogs }) => {
    const [isStatsExpanded, setIsStatsExpanded] = useState(true);
    const [activeSlide, setActiveSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const highlights = useMemo(() => {
        const totalUnits = units.length;
        if (totalUnits === 0) return { occupancy: 0, ownerRatio: 0, dataHealth: 0, topVehicles: [], totalUnits: 0, occupiedUnits: 0, ownerCount: 0 };
        
        const occupiedUnits = owners.filter(o => o.OwnerName && o.OwnerName !== '[Trống]').length;
        const occupancy = (occupiedUnits / totalUnits) * 100;
        
        const ownerCount = units.filter(u => u.Status === 'Owner').length;
        const ownerRatio = (ownerCount / totalUnits) * 100;

        const dataHealth = owners.filter(o => !o.Phone || !o.Email).length;
        
        const vehicleCounts = vehicles.reduce((acc: Record<string, number>, v) => {
            if (v.isActive) {
                const currentCount = acc[v.UnitID] || 0;
                acc[v.UnitID] = currentCount + 1;
            }
            return acc;
        }, {});
        
        const topVehicles = Object.entries(vehicleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([unitId, count]) => ({ unitId, count }));
            
        return { occupancy, ownerRatio, dataHealth, topVehicles, totalUnits, occupiedUnits, ownerCount };
    }, [units, owners, vehicles]);

    const slides = useMemo(() => [
        {
            id: 'occupancy',
            icon: <HomeIcon className="w-8 h-8 text-blue-600" />,
            title: 'Tỷ lệ Lấp đầy',
            value: `${highlights.occupancy.toFixed(0)}%`,
            subtext: `${highlights.occupiedUnits}/${highlights.totalUnits} căn`,
            progress: highlights.occupancy,
        },
        {
            id: 'ownership',
            icon: <UserGroupIcon className="w-8 h-8 text-green-600" />,
            title: 'Cơ cấu Cư dân',
            value: `${highlights.ownerRatio.toFixed(0)}%`,
            subtext: `${highlights.ownerCount} hộ là chính chủ`,
        },
        {
            id: 'dataHealth',
            icon: <WarningIcon className="w-8 h-8 text-yellow-600" />,
            title: 'Cảnh báo Dữ liệu',
            value: highlights.dataHealth,
            subtext: 'căn thiếu SĐT/Email',
        },
        {
            id: 'topVehicles',
            icon: <CarIcon className="w-8 h-8 text-purple-600" />,
            title: 'Top Sở hữu Xe',
            list: highlights.topVehicles,
        },
    ], [highlights]);

    useEffect(() => {
        if (!isStatsExpanded || isPaused) return;
        const timer = setInterval(() => {
            setActiveSlide((prev: number) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length, isStatsExpanded, isPaused]);

    const goToNext = () => setActiveSlide(prev => (prev + 1) % slides.length);
    const goToPrev = () => setActiveSlide(prev => (prev - 1 + slides.length) % slides.length);

    const currentSlideData = slides[activeSlide];
    
    return (
        <div className="p-6 flex flex-col">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-200">Thống kê nổi bật</h2>
                <button
                    onClick={() => setIsStatsExpanded(p => !p)}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"
                    data-tooltip={isStatsExpanded ? "Thu gọn" : "Mở rộng"}
                >
                    {isStatsExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
            </div>
            
            {isStatsExpanded && (
                <div
                    className="relative mt-4 flex-shrink-0"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <div key={activeSlide} className="bg-white dark:bg-dark-bg-secondary p-6 rounded-xl shadow-sm border dark:border-dark-border flex flex-col items-center justify-center text-center h-[220px] animate-fade-in-down">
                        {currentSlideData.icon}
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-3">{currentSlideData.title}</p>
                        
                        {currentSlideData.value != null && <p className="text-4xl font-bold text-gray-900 dark:text-gray-200 mt-1">{currentSlideData.value}</p>}
                        
                        {currentSlideData.progress != null && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mt-3">
                                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${currentSlideData.progress}%` }}></div>
                            </div>
                        )}
                        
                        {currentSlideData.subtext && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{currentSlideData.subtext}</p>}
                        
                        {currentSlideData.list && currentSlideData.list.length > 0 && (
                            <ul className="space-y-1 mt-2 w-full max-w-xs">
                                {currentSlideData.list.map(item => (
                                    <li key={item.unitId} className="flex justify-between text-sm">
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">Căn hộ {item.unitId}</span>
                                        <span className="font-bold text-purple-700 dark:text-purple-300">{item.count} xe</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                         {currentSlideData.list && currentSlideData.list.length === 0 && <p className="text-sm text-gray-500 mt-4">Chưa có dữ liệu xe</p>}
                    </div>

                    <button onClick={goToPrev} className="absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary z-10">
                        <ChevronLeftIcon />
                    </button>
                    <button onClick={goToNext} className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary z-10">
                        <ChevronRightIcon />
                    </button>
                </div>
            )}
            
            <div className="border-t dark:border-dark-border pt-6 mt-6 flex-1 flex flex-col min-h-0">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2 flex-shrink-0">
                    <ClipboardDocumentListIcon/> Hoạt động gần đây
                </h3>
                <ul className="space-y-4 pr-2">
                    {activityLogs.filter(log => log.module === 'Residents').slice(0, 10).map(log => (
                        <li key={log.id} className="flex items-start space-x-3">
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2 mt-1">
                                <UserCircleIcon className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-800 dark:text-gray-200">{log.summary}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    bởi {log.actor_email.split('@')[0]} - {timeAgo(log.ts)}
                                </p>
                            </div>
                        </li>
                    ))}
                    {activityLogs.filter(log => log.module === 'Residents').length === 0 && <p className="text-sm text-center text-gray-500 py-4">Chưa có hoạt động nào liên quan đến cư dân.</p>}
                </ul>
            </div>
        </div>
    );
}

export default ResidentsPage;