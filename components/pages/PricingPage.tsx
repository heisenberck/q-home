
import React, { useState } from 'react';
import type { TariffService, TariffParking, TariffWater, Role } from '../../types';
import Modal from '../ui/Modal';
import { useNotification } from '../../App';
import { PencilSquareIcon } from '../ui/Icons';

interface PricingPageProps {
    tariffs: {
        service: TariffService[];
        parking: TariffParking[];
        water: TariffWater[];
    };
    setTariffs: (tariffs: PricingPageProps['tariffs']) => void;
    role: Role;
}

const PricingPage: React.FC<PricingPageProps> = ({ tariffs, setTariffs, role }) => {
    const { showToast } = useNotification();
    const canEdit = role === 'Admin';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ type: string; data: any } | null>(null);

    const handleEdit = (type: string, data: any) => {
        if (!canEdit) {
            showToast('Bạn không có quyền chỉnh sửa đơn giá.', 'error');
            return;
        }
        setEditingItem({ type, data });
        setIsModalOpen(true);
    };

    const handleSave = (updatedData: any) => {
        const { type } = editingItem!;
        const newTariffs = { ...tariffs };
        
        if (type === 'service') {
            const index = newTariffs.service.findIndex(t => t.LoaiHinh === updatedData.LoaiHinh);
            newTariffs.service[index] = updatedData;
        } else if (type === 'parking') {
            const index = newTariffs.parking.findIndex(t => t.Tier === updatedData.Tier);
            newTariffs.parking[index] = updatedData;
        } else if (type === 'water') {
            const index = newTariffs.water.findIndex(t => t.From_m3 === updatedData.From_m3);
            newTariffs.water[index] = updatedData;
        }

        setTariffs(newTariffs);
        showToast('Cập nhật đơn giá thành công!', 'success');
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN').format(val);
    const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '---';

    // Reusable Table Component with Sticky Header
    const TariffTable: React.FC<{ 
        title: string; 
        headers: { label: string; align?: 'left' | 'right' | 'center' }[]; 
        children: React.ReactNode 
    }> = ({ title, headers, children }) => (
        <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">{title}</h3>
            <div className="overflow-auto max-h-[500px] border border-light-border dark:border-dark-border rounded-md">
                <table className="min-w-full themed-table">
                    <thead className="sticky top-0 z-20 shadow-sm">
                        <tr>
                            {headers.map((h, i) => (
                                <th key={i} className={`bg-gray-100 dark:bg-gray-800 whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-${h.align || 'left'}`}>
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-dark-bg-secondary">
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    );
    
    return (
        <div className="space-y-8 pricing-page-container pb-8">
            <TariffTable 
                title="Biểu phí Dịch vụ" 
                headers={[
                    { label: 'Loại hình', align: 'left' },
                    { label: 'Đơn giá / m²', align: 'right' },
                    { label: 'VAT (%)', align: 'right' },
                    { label: 'Từ ngày', align: 'center' },
                    { label: 'Đến ngày', align: 'center' },
                    { label: 'Hành động', align: 'center' }
                ]}
            >
                {tariffs.service.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium">{item.LoaiHinh}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.ServiceFee_per_m2)}</td>
                        <td className="px-4 py-3 text-right">{item.VAT_percent}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidFrom)}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidTo)}</td>
                        <td className="px-4 py-3 text-center">
                            <button onClick={() => handleEdit('service', item)} disabled={!canEdit} className="text-primary hover:text-primary-focus disabled:text-gray-400 p-1">
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                ))}
            </TariffTable>

            <TariffTable 
                title="Biểu phí Gửi xe" 
                headers={[
                    { label: 'Loại xe / Bậc', align: 'left' },
                    { label: 'Đơn giá', align: 'right' },
                    { label: 'VAT (%)', align: 'right' },
                    { label: 'Từ ngày', align: 'center' },
                    { label: 'Đến ngày', align: 'center' },
                    { label: 'Hành động', align: 'center' }
                ]}
            >
                {tariffs.parking.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium">{item.Tier}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.Price_per_unit)}</td>
                        <td className="px-4 py-3 text-right">{item.VAT_percent}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidFrom)}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidTo)}</td>
                         <td className="px-4 py-3 text-center">
                            <button onClick={() => handleEdit('parking', item)} disabled={!canEdit} className="text-primary hover:text-primary-focus disabled:text-gray-400 p-1">
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                ))}
            </TariffTable>

            <TariffTable 
                title="Biểu phí Nước sinh hoạt" 
                headers={[
                    { label: 'Từ (m³)', align: 'right' },
                    { label: 'Đến (m³)', align: 'right' },
                    { label: 'Đơn giá', align: 'right' },
                    { label: 'VAT (%)', align: 'right' },
                    { label: 'Từ ngày', align: 'center' },
                    { label: 'Đến ngày', align: 'center' },
                    { label: 'Hành động', align: 'center' }
                ]}
            >
                {tariffs.water.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-right">{item.From_m3}</td>
                        <td className="px-4 py-3 text-right">{item.To_m3 === null ? 'Trở lên' : item.To_m3}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.UnitPrice)}</td>
                        <td className="px-4 py-3 text-right">{item.VAT_percent}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidFrom)}</td>
                        <td className="px-4 py-3 text-center">{formatDate(item.ValidTo)}</td>
                        <td className="px-4 py-3 text-center">
                            <button onClick={() => handleEdit('water', item)} disabled={!canEdit} className="text-primary hover:text-primary-focus disabled:text-gray-400 p-1">
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                ))}
            </TariffTable>
            
            {isModalOpen && editingItem && (
                <Modal title={`Sửa đơn giá - ${editingItem.type}`} onClose={() => setIsModalOpen(false)}>
                    <EditForm item={editingItem.data} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}
        </div>
    );
};

const EditForm: React.FC<{ item: any; onSave: (data: any) => void; onCancel: () => void }> = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData({ ...formData, [name]: type === 'number' ? parseFloat(value) : value });
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
            {Object.entries(formData).map(([key, value]) => (
                 <div key={key}>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary capitalize mb-1">
                        {key.replace(/_/g, ' ')}
                    </label>
                    <input 
                        type={typeof value === 'number' ? 'number' : 'text'}
                        name={key}
                        value={String(value ?? '')}
                        onChange={handleChange}
                        disabled={['LoaiHinh', 'Tier', 'From_m3'].includes(key)}
                        className="w-full p-2 border rounded-md bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border disabled:bg-gray-200 dark:disabled:bg-gray-700 text-light-text-primary dark:text-dark-text-primary focus:ring-primary focus:border-primary"
                    />
                </div>
            ))}
            <div className="flex justify-end gap-2 pt-4 border-t border-light-border dark:border-dark-border">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-light-text-primary dark:text-dark-text-primary">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-focus">Lưu</button>
            </div>
        </form>
    );
};

export default PricingPage;
