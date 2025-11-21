import React, { useState, useEffect } from 'react';
import { MOCK_TARIFFS_SERVICE, MOCK_TARIFFS_PARKING, MOCK_TARIFFS_WATER } from '../constants';
import type { TariffService, TariffParking, TariffWater } from '../types';
import { UnitType, ParkingTariffTier } from '../types';
import { useAuth, useNotification } from '../App';

// Modal component for forms
const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void; }> = ({ title, children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-background dark:bg-dark-secondary rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b dark:border-dark-border-color flex justify-between items-center">
                <h3 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{title}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

// Tariff Form Component
const TariffForm: React.FC<{ tariff: any, type: 'service' | 'parking' | 'water', onSave: (data: any) => void, onCancel: () => void }> = ({ tariff, type, onSave, onCancel }) => {
    const [formData, setFormData] = useState(tariff);

    // Define consistent styles
    const inputStyle = "w-full p-2 border rounded-md bg-background dark:bg-dark-background border-border-color dark:border-dark-border-color text-text-primary dark:text-dark-text-primary focus:ring-primary focus:border-primary";
    const disabledInputStyle = "w-full p-2 border rounded-md bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed";
    const labelStyle = "block text-sm font-medium text-text-secondary dark:text-dark-text-secondary";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type: inputType } = e.target;
         // Handle null for 'To_m3' when input is cleared
        if (name === 'To_m3' && value === '') {
            setFormData({ ...formData, [name]: null });
            return;
        }
        setFormData({ ...formData, [name]: inputType === 'number' ? (value === '' ? '' : parseFloat(value)) : value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Ensure To_m3 is null if it's an empty string before saving
        const dataToSave = { ...formData };
        if (dataToSave.To_m3 === '') {
            dataToSave.To_m3 = null;
        }
        onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {type === 'service' && <>
                {/* FIX: Use `LoaiHinh` instead of the non-existent `UnitType` property. */}
                <label className={labelStyle}>Loại hình</label><input value={formData.LoaiHinh} className={disabledInputStyle} disabled/>
                <label className={labelStyle}>Đơn giá / m²</label><input name="ServiceFee_per_m2" type="number" value={formData.ServiceFee_per_m2 ?? ''} onChange={handleChange} className={inputStyle}/>
            </>}
            {type === 'parking' && <>
                 <label className={labelStyle}>Loại xe / Bậc</label><input value={formData.Tier} className={disabledInputStyle} disabled/>
                <label className={labelStyle}>Đơn giá</label><input name="Price_per_unit" type="number" value={formData.Price_per_unit ?? ''} onChange={handleChange} className={inputStyle}/>
            </>}
             {type === 'water' && <>
                <label className={labelStyle}>Từ (m³)</label><input name="From_m3" type="number" value={formData.From_m3 ?? ''} onChange={handleChange} className={inputStyle}/>
                <label className={labelStyle}>Đến (m³)</label><input name="To_m3" type="number" value={formData.To_m3 ?? ''} onChange={handleChange} placeholder="Để trống nếu vô hạn" className={inputStyle}/>
                <label className={labelStyle}>Đơn giá</label><input name="UnitPrice" type="number" value={formData.UnitPrice ?? ''} onChange={handleChange} className={inputStyle}/>
            </>}
            <label className={labelStyle}>VAT (%)</label><input name="VAT_percent" type="number" value={formData.VAT_percent ?? ''} onChange={handleChange} className={inputStyle}/>
            <label className={labelStyle}>Áp dụng từ</label><input name="ValidFrom" type="date" value={formData.ValidFrom || ''} onChange={handleChange} className={inputStyle}/>
            <label className={labelStyle}>Hết hiệu lực</label><input name="ValidTo" type="date" value={formData.ValidTo || ''} onChange={handleChange} className={inputStyle}/>

            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">Lưu</button>
            </div>
        </form>
    );
};


const TariffCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h3 className="text-xl font-semibold text-text-primary dark:text-dark-text-primary mb-3">{title}</h3>
        <div className="bg-background dark:bg-dark-secondary p-4 rounded-lg shadow-md overflow-x-auto">
            {children}
        </div>
    </div>
);

const TariffTable: React.FC<{ headers: string[], data: any[], renderRow: (item: any, index: number) => React.ReactNode }> = ({ headers, data, renderRow }) => (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border-color">
        <thead className="bg-gray-50 dark:bg-dark-secondary">
            <tr>
                {headers.map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{header}</th>
                ))}
            </tr>
        </thead>
        <tbody className="bg-white dark:bg-dark-background divide-y divide-gray-200 dark:divide-dark-border-color">
            {data.map(renderRow)}
        </tbody>
    </table>
);

const TariffManagement: React.FC = () => {
    const { role } = useAuth();
    // FIX: The `useNotification` hook returns `showToast`, not `showNotification`. Aliasing to match usage in the component.
    const { showToast: showNotification } = useNotification();
    const canEdit = ['Admin'].includes(role);
    const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

    const [serviceTariffs, setServiceTariffs] = useState<TariffService[]>(MOCK_TARIFFS_SERVICE);
    const [parkingTariffs, setParkingTariffs] = useState<TariffParking[]>(MOCK_TARIFFS_PARKING);
    const [waterTariffs, setWaterTariffs] = useState<TariffWater[]>(MOCK_TARIFFS_WATER);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTariff, setEditingTariff] = useState<any>(null); // Contains original tariff for comparison
    const [tariffType, setTariffType] = useState<'service' | 'parking' | 'water' | null>(null);

    const [previewDate, setPreviewDate] = useState(new Date().toISOString().split('T')[0]);
    
    const findActiveTariff = (tariffs: any[], date: string, filterFn: (t: any) => boolean) => {
        const checkDate = new Date(date);
        return tariffs
            .filter(filterFn)
            .sort((a, b) => new Date(b.ValidFrom).getTime() - new Date(a.ValidFrom).getTime()) // Most recent first
            .find(t => {
                const from = new Date(t.ValidFrom);
                const to = t.ValidTo ? new Date(t.ValidTo) : null;
                if (to) {
                    return from <= checkDate && checkDate <= to;
                }
                return from <= checkDate;
            });
    };
    
    const activeApartmentServiceTariff = findActiveTariff(serviceTariffs, previewDate, t => t.LoaiHinh === UnitType.APARTMENT);

    const handleOpenModal = (type: 'service' | 'parking' | 'water', item: any | null = null) => {
        if (!canEdit) {
            showNotification('Bạn không có quyền thực hiện hành động này.', 'error');
            return;
        }
        setTariffType(type);
        setEditingTariff(item); // if item is null, it's a new tariff
        setIsModalOpen(true);
    };

    const handleSave = (formData: any) => {
        const isEditing = !!editingTariff;
        
        // --- Versioning Logic for ADD NEW ---
        if (!isEditing) {
            const newValidFrom = new Date(formData.ValidFrom);
            const oldValidToStr = new Date(newValidFrom.getTime() - 86400000).toISOString().split('T')[0]; // Previous day

            if (tariffType === 'service') {
                let tariffToUpdateFound = false;
                const updatedTariffs = serviceTariffs.map(t => {
                    // FIX: Use `LoaiHinh` instead of the non-existent `UnitType` property.
                    if (t.LoaiHinh === formData.LoaiHinh && !t.ValidTo && new Date(t.ValidFrom) < newValidFrom) {
                        tariffToUpdateFound = true;
                        return { ...t, ValidTo: oldValidToStr };
                    }
                    return t;
                });
                if(tariffToUpdateFound) setServiceTariffs([...updatedTariffs, formData]);
                else setServiceTariffs([...serviceTariffs, formData]);
            }
             // Add similar logic for parking and water if needed
        } else { // --- Update Logic for EDIT ---
             if (tariffType === 'service') {
                // FIX: Use `LoaiHinh` instead of the non-existent `UnitType` property.
                setServiceTariffs(serviceTariffs.map(t => (t.ValidFrom === editingTariff.ValidFrom && t.LoaiHinh === editingTariff.LoaiHinh) ? { ...formData } : t));
            }
            if (tariffType === 'parking') {
                setParkingTariffs(parkingTariffs.map(t => (t.ValidFrom === editingTariff.ValidFrom && t.Tier === editingTariff.Tier) ? { ...formData } : t));
            }
            if (tariffType === 'water') {
                setWaterTariffs(waterTariffs.map(t => (t.ValidFrom === editingTariff.ValidFrom && t.From_m3 === editingTariff.From_m3) ? { ...formData } : t));
            }
        }
        
        showNotification('Lưu đơn giá thành công!', 'success');
        setIsModalOpen(false);
    };

    const getStatus = (item: any) => {
        const today = new Date();
        const from = new Date(item.ValidFrom);
        const to = item.ValidTo ? new Date(item.ValidTo) : null;

        if (from > today) return { text: 'Sắp áp dụng', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
        if (!to || to >= today) return { text: 'Đang áp dụng', class: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
        return { text: 'Hết hiệu lực', class: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300' };
    };

    const renderActions = (type: 'service' | 'parking' | 'water', item: any) => (
        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
             <button onClick={() => handleOpenModal(type, item)} className="text-primary hover:text-primary-dark mr-4 disabled:text-gray-400" disabled={!canEdit}>Sửa</button>
        </td>
    )

    return (
        <div className="bg-background dark:bg-dark-secondary p-6 rounded-lg shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary">Quản lý Đơn giá</h2>
                <div className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <label htmlFor="preview-date" className="font-semibold text-sm text-text-secondary dark:text-dark-text-secondary">Xem giá áp dụng ngày:</label>
                    <input 
                        type="date"
                        id="preview-date"
                        value={previewDate}
                        onChange={e => setPreviewDate(e.target.value)}
                        className="p-1 border rounded-md bg-background dark:bg-dark-secondary border-border-color dark:border-dark-border-color text-text-primary dark:text-dark-text-primary"
                    />
                    {activeApartmentServiceTariff && <p className="text-sm text-text-primary dark:text-dark-text-primary">Phí DV Căn hộ: <span className="font-bold">{formatCurrency(activeApartmentServiceTariff.ServiceFee_per_m2)}</span></p>}
                </div>
            </div>

            <TariffCard title="Biểu phí Dịch vụ">
                 <button onClick={() => handleOpenModal('service', null)} disabled={!canEdit} className="mb-2 px-3 py-1 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400">Thêm mới</button>
                <TariffTable
                    headers={['Loại hình', 'Đơn giá / m²', 'VAT', 'Áp dụng từ', 'Hết hạn', 'Trạng thái', 'Hành động']}
                    data={serviceTariffs}
                    renderRow={(item, index) => {
                        const status = getStatus(item);
                        return (
                        <tr key={index}>
                            <td className="px-4 py-4 whitespace-nowrap font-medium text-text-primary dark:text-dark-text-primary">{item.LoaiHinh}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{formatCurrency(item.ServiceFee_per_m2)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.VAT_percent}%</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{new Date(item.ValidFrom).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.ValidTo ? new Date(item.ValidTo).toLocaleDateString('vi-VN') : ''}</td>
                            <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>{status.text}</span></td>
                            {renderActions('service', item)}
                        </tr>
                    )}}
                />
            </TariffCard>

            <TariffCard title="Biểu phí Gửi xe">
                 <button onClick={() => handleOpenModal('parking', null)} disabled={!canEdit} className="mb-2 px-3 py-1 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400">Thêm mới</button>
                 <TariffTable
                    headers={['Loại xe / Bậc phí', 'Đơn giá', 'VAT', 'Áp dụng từ', 'Hết hạn', 'Trạng thái', 'Hành động']}
                    data={parkingTariffs}
                    renderRow={(item, index) => {
                        const status = getStatus(item);
                        return (
                        <tr key={index}>
                            <td className="px-4 py-4 whitespace-nowrap font-medium text-text-primary dark:text-dark-text-primary">{item.Tier}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{formatCurrency(item.Price_per_unit)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.VAT_percent}%</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{new Date(item.ValidFrom).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.ValidTo ? new Date(item.ValidTo).toLocaleDateString('vi-VN') : ''}</td>
                             <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>{status.text}</span></td>
                              {renderActions('parking', item)}
                        </tr>
                    )}}
                />
                 <div className="p-4 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md mt-2 text-text-secondary dark:text-dark-text-secondary">
                    <b>Ghi chú Xe máy:</b> 2 xe đầu 60,000đ/xe, từ xe thứ 3 giá 80,000đ/xe. (VAT 8%)
                </div>
            </TariffCard>

            <TariffCard title="Biểu phí Nước sinh hoạt">
                <button onClick={() => handleOpenModal('water', null)} disabled={!canEdit} className="mb-2 px-3 py-1 bg-primary text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-dark disabled:bg-gray-400">Thêm mới</button>
                <TariffTable
                    headers={['Từ (m³)', 'Đến (m³)', 'Đơn giá', 'VAT', 'Áp dụng từ', 'Hết hạn', 'Trạng thái', 'Hành động']}
                    data={waterTariffs}
                    renderRow={(item, index) => {
                         const status = getStatus(item);
                         return (
                        <tr key={index}>
                            <td className="px-4 py-4 whitespace-nowrap font-medium text-text-primary dark:text-dark-text-primary">{item.From_m3}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.To_m3 ?? 'trở lên'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{formatCurrency(item.UnitPrice)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.VAT_percent}%</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{new Date(item.ValidFrom).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-text-secondary dark:text-dark-text-secondary">{item.ValidTo ? new Date(item.ValidTo).toLocaleDateString('vi-VN') : ''}</td>
                             <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.class}`}>{status.text}</span></td>
                             {renderActions('water', item)}
                        </tr>
                    )}}
                />
                 <div className="p-4 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md mt-2 text-text-secondary dark:text-dark-text-secondary">
                    <b>Ghi chú KIOS:</b> Áp dụng mức giá cao nhất (31,050đ) cho toàn bộ lượng nước tiêu thụ.
                </div>
            </TariffCard>
            
            {isModalOpen && (
                 <Modal title={editingTariff ? `Sửa đơn giá` : `Thêm đơn giá mới`} onClose={() => setIsModalOpen(false)}>
                    <TariffForm 
                        tariff={editingTariff || { ValidFrom: new Date().toISOString().split('T')[0] }}
                        type={tariffType!}
                        onSave={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default TariffManagement;
