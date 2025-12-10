import React, { useState, useMemo } from 'react';
import type { TariffService, TariffParking, TariffWater, Role, TariffCollection } from '../../types';
import Modal from '../ui/Modal';
import { useNotification } from '../../App';
import { PencilSquareIcon, TagIcon, CarIcon, DropletsIcon } from '../ui/Icons';
import StatCard from '../ui/StatCard';
import { formatCurrency } from '../../utils/helpers';

interface PricingPageProps {
    tariffs: TariffCollection;
    setTariffs: (updater: React.SetStateAction<TariffCollection>, logPayload?: any) => void;
    role: Role;
}

const EditForm: React.FC<{ item: any; onSave: (data: any) => void; onCancel: () => void }> = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
        setFormData({ ...formData, [name]: parsedValue });
    };

    const inputStyle = "w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary focus:border-transparent outline-none";
    const labelStyle = "block text-sm font-medium text-gray-700 mb-1 capitalize";

    const renderFields = () => {
        // Determine type based on keys
        if ('ServiceFee_per_m2' in formData) { // Service
            return <>
                <div><label className={labelStyle}>Loại hình</label><input value={formData.LoaiHinh} className={inputStyle} disabled /></div>
                <div><label className={labelStyle}>Đơn giá / m²</label><input type="number" name="ServiceFee_per_m2" value={formData.ServiceFee_per_m2} onChange={handleChange} className={inputStyle} /></div>
                <div><label className={labelStyle}>VAT %</label><input type="number" name="VAT_percent" value={formData.VAT_percent} onChange={handleChange} className={inputStyle} /></div>
                <div><label className={labelStyle}>Ngày hết hạn (YYYY-MM-DD)</label><input type="text" name="ValidTo" value={formData.ValidTo || ''} onChange={handleChange} className={inputStyle} placeholder="Để trống nếu đang áp dụng" /></div>
            </>;
        }
        if ('Price_per_unit' in formData) { // Parking
            return <>
                <div><label className={labelStyle}>Loại xe / Bậc</label><input value={formData.Tier} className={inputStyle} disabled /></div>
                <div><label className={labelStyle}>Đơn giá</label><input type="number" name="Price_per_unit" value={formData.Price_per_unit} onChange={handleChange} className={inputStyle} /></div>
                <div><label className={labelStyle}>VAT %</label><input type="number" name="VAT_percent" value={formData.VAT_percent} onChange={handleChange} className={inputStyle} /></div>
                <div><label className={labelStyle}>Ngày hết hạn (YYYY-MM-DD)</label><input type="text" name="ValidTo" value={formData.ValidTo || ''} onChange={handleChange} className={inputStyle} placeholder="Để trống nếu đang áp dụng" /></div>
            </>;
        }
         if ('UnitPrice' in formData) { // Water
            return <>
                <div><label className={labelStyle}>Từ (m³)</label><input value={formData.From_m3} className={inputStyle} disabled /></div>
                <div><label className={labelStyle}>Đến (m³)</label><input type="number" name="To_m3" value={formData.To_m3 ?? ''} onChange={handleChange} className={inputStyle} placeholder="Để trống cho bậc cuối"/></div>
                <div><label className={labelStyle}>Đơn giá</label><input type="number" name="UnitPrice" value={formData.UnitPrice} onChange={handleChange} className={inputStyle} /></div>
                <div><label className={labelStyle}>VAT %</label><input type="number" name="VAT_percent" value={formData.VAT_percent} onChange={handleChange} className={inputStyle} /></div>
                <div className="md:col-span-2"><label className={labelStyle}>Ngày hết hạn (YYYY-MM-DD)</label><input type="text" name="ValidTo" value={formData.ValidTo || ''} onChange={handleChange} className={inputStyle} placeholder="Để trống nếu đang áp dụng" /></div>
            </>
        }
        return <p>Unknown tariff type</p>;
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
               {renderFields()}
            </div>
            <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus">Lưu thay đổi</button>
            </div>
        </form>
    );
};


const PricingPage: React.FC<PricingPageProps> = ({ tariffs, setTariffs, role }) => {
    const { showToast } = useNotification();
    const canEdit = useMemo(() => role === 'Admin', [role]);

    const [activeTab, setActiveTab] = useState<'service' | 'parking' | 'water'>('service');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ type: 'service' | 'parking' | 'water'; data: any } | null>(null);

    const handleEdit = (type: 'service' | 'parking' | 'water', data: any) => {
        if (!canEdit) {
            showToast('Bạn không có quyền chỉnh sửa đơn giá.', 'error');
            return;
        }
        setEditingItem({ type, data });
        setIsModalOpen(true);
    };

    const handleSave = (updatedData: any) => {
        if (!editingItem) return;
        const { type } = editingItem;
        
        const newTariffs = JSON.parse(JSON.stringify(tariffs));
        let index = -1;
        
        if (type === 'service') {
            index = newTariffs.service.findIndex((t: TariffService) => t.LoaiHinh === updatedData.LoaiHinh);
            if (index > -1) newTariffs.service[index] = updatedData;
        } else if (type === 'parking') {
            index = newTariffs.parking.findIndex((t: TariffParking) => t.Tier === updatedData.Tier);
            if (index > -1) newTariffs.parking[index] = updatedData;
        } else if (type === 'water') {
            index = newTariffs.water.findIndex((t: TariffWater) => t.From_m3 === updatedData.From_m3);
            if (index > -1) newTariffs.water[index] = updatedData;
        }
        
        setTariffs(newTariffs, {
            module: 'Pricing',
            action: 'UPDATE_TARIFF',
            summary: `Cập nhật đơn giá cho ${type}: ${updatedData.LoaiHinh || updatedData.Tier || `Bậc ${updatedData.From_m3}`}`,
            before_snapshot: tariffs,
        });
        showToast('Cập nhật đơn giá thành công!', 'success');
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : null;

    const TabButton: React.FC<{ tabId: 'service' | 'parking' | 'water', label: string, icon: React.ReactNode }> = ({ tabId, label, icon }) => (
        <button 
            type="button" 
            onClick={() => setActiveTab(tabId)} 
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-200 ${activeTab === tabId ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            role="tab"
            aria-selected={activeTab === tabId}
        >
            {icon} {label}
        </button>
    );

    const tableHeaderClass = "px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider";
    const tableRowClass = "hover:bg-gray-50 text-sm text-gray-800";
    const tableCellClass = "px-4 py-3";

    return (
        <div className="space-y-6">
            {isModalOpen && editingItem && (
                <Modal title={`Chỉnh sửa Đơn giá ${editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)}`} onClose={() => setIsModalOpen(false)}>
                    <EditForm item={editingItem.data} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <StatCard 
                    label="Biểu phí Dịch vụ" 
                    value={`${tariffs.service.length} mục`} 
                    icon={<TagIcon className="w-6 h-6 text-blue-600"/>} 
                    iconBgClass="bg-blue-100" 
                    className="border-l-4 border-blue-500"
                    onClick={() => setActiveTab('service')}
                />
                <StatCard 
                    label="Biểu phí Gửi xe" 
                    value={`${tariffs.parking.length} mục`} 
                    icon={<CarIcon className="w-6 h-6 text-orange-600"/>} 
                    iconBgClass="bg-orange-100" 
                    className="border-l-4 border-orange-500"
                    onClick={() => setActiveTab('parking')}
                />
                <StatCard 
                    label="Biểu phí Nước" 
                    value={`${tariffs.water.length} mục`} 
                    icon={<DropletsIcon className="w-6 h-6 text-cyan-600"/>} 
                    iconBgClass="bg-cyan-100" 
                    className="border-l-4 border-cyan-500"
                    onClick={() => setActiveTab('water')}
                />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px px-6" role="tablist" aria-label="Bảng giá">
                        <TabButton tabId="service" label="Dịch vụ" icon={<TagIcon className="w-4 h-4" />}/>
                        <TabButton tabId="parking" label="Gửi xe" icon={<CarIcon className="w-4 h-4" />}/>
                        <TabButton tabId="water" label="Nước" icon={<DropletsIcon className="w-4 h-4" />}/>
                    </nav>
                </div>
                
                <div className="p-6">
                    {activeTab === 'service' && (
                        <div className="overflow-x-auto" role="tabpanel">
                            <table className="min-w-full">
                                <thead><tr>
                                    <th className={tableHeaderClass}>Loại hình</th>
                                    <th className={`${tableHeaderClass} text-right`}>Đơn giá / m²</th>
                                    <th className={`${tableHeaderClass} text-center`}>VAT</th>
                                    <th className={`${tableHeaderClass} text-center`}>Trạng thái</th>
                                    <th className={`${tableHeaderClass} text-center`}>Hành động</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                {tariffs.service.map((item) => (
                                    <tr key={item.LoaiHinh} className={tableRowClass}>
                                        <td className={`${tableCellClass} font-semibold`}>{item.LoaiHinh}</td>
                                        <td className={`${tableCellClass} text-right font-bold text-primary font-mono`}>{formatCurrency(item.ServiceFee_per_m2)}</td>
                                        <td className={`${tableCellClass} text-center`}><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{item.VAT_percent}%</span></td>
                                        <td className={`${tableCellClass} text-center`}>{!item.ValidTo ? <span className="text-green-600 font-semibold text-xs">Đang áp dụng</span> : <span className="text-gray-500 text-xs">Hết hạn {formatDate(item.ValidTo)}</span>}</td>
                                        <td className={`${tableCellClass} text-center`}><button onClick={() => handleEdit('service', item)} disabled={!canEdit} className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 p-1 rounded-full hover:bg-blue-50" aria-label={`Sửa ${item.LoaiHinh}`}><PencilSquareIcon/></button></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'parking' && (
                        <div className="overflow-x-auto" role="tabpanel">
                            <table className="min-w-full">
                                <thead><tr>
                                    <th className={tableHeaderClass}>Loại xe / Bậc</th>
                                    <th className={`${tableHeaderClass} text-right`}>Đơn giá</th>
                                    <th className={`${tableHeaderClass} text-center`}>VAT</th>
                                    <th className={`${tableHeaderClass} text-center`}>Trạng thái</th>
                                    <th className={`${tableHeaderClass} text-center`}>Hành động</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                {tariffs.parking.map((item) => (
                                    <tr key={item.Tier} className={tableRowClass}>
                                        <td className={`${tableCellClass} font-semibold`}>{item.Tier}</td>
                                        <td className={`${tableCellClass} text-right font-bold text-primary font-mono`}>{formatCurrency(item.Price_per_unit)}</td>
                                        <td className={`${tableCellClass} text-center`}><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{item.VAT_percent}%</span></td>
                                        <td className={`${tableCellClass} text-center`}>{!item.ValidTo ? <span className="text-green-600 font-semibold text-xs">Đang áp dụng</span> : <span className="text-gray-500 text-xs">Hết hạn {formatDate(item.ValidTo)}</span>}</td>
                                        <td className={`${tableCellClass} text-center`}><button onClick={() => handleEdit('parking', item)} disabled={!canEdit} className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 p-1 rounded-full hover:bg-blue-50" aria-label={`Sửa ${item.Tier}`}><PencilSquareIcon/></button></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'water' && (
                        <div className="overflow-x-auto" role="tabpanel">
                            <table className="min-w-full">
                                <thead><tr>
                                    <th className={`${tableHeaderClass} text-right`}>Từ (m³)</th>
                                    <th className={`${tableHeaderClass} text-right`}>Đến (m³)</th>
                                    <th className={`${tableHeaderClass} text-right`}>Đơn giá</th>
                                    <th className={`${tableHeaderClass} text-center`}>VAT</th>
                                    <th className={`${tableHeaderClass} text-center`}>Trạng thái</th>
                                    <th className={`${tableHeaderClass} text-center`}>Hành động</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                {tariffs.water.map((item, index) => (
                                    <tr key={index} className={tableRowClass}>
                                        <td className={`${tableCellClass} text-right`}>{item.From_m3}</td>
                                        <td className={`${tableCellClass} text-right`}>{item.To_m3 === null ? 'Trở lên' : item.To_m3}</td>
                                        <td className={`${tableCellClass} text-right font-bold text-primary font-mono`}>{formatCurrency(item.UnitPrice)}</td>
                                        <td className={`${tableCellClass} text-center`}><span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">{item.VAT_percent}%</span></td>
                                        <td className={`${tableCellClass} text-center`}>{!item.ValidTo ? <span className="text-green-600 font-semibold text-xs">Đang áp dụng</span> : <span className="text-gray-500 text-xs">Hết hạn {formatDate(item.ValidTo)}</span>}</td>
                                        <td className={`${tableCellClass} text-center`}><button onClick={() => handleEdit('water', item)} disabled={!canEdit} className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 p-1 rounded-full hover:bg-blue-50" aria-label={`Sửa bậc ${item.From_m3}`}><PencilSquareIcon/></button></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
