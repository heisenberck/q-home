
import React, { useState, useMemo, useEffect } from 'react';
import type { Role, ServiceRegistration, RegistrationStatus, RegistrationType } from '../../types';
import { useNotification, useAuth } from '../../App';
import Modal from '../ui/Modal';
import { 
    SearchIcon, CheckCircleIcon, XMarkIcon, EyeIcon, 
    HomeIcon, CarIcon, HammerIcon, ClockIcon,
    WarningIcon, ChevronDownIcon, CalendarDaysIcon,
    UserIcon, InformationCircleIcon, CloudArrowUpIcon,
    FileTextIcon, BikeIcon, DocumentArrowDownIcon,
    CheckIcon, ClipboardCheckIcon
} from '../ui/Icons';
import Spinner from '../ui/Spinner';
import StatCard from '../ui/StatCard';
import { translateVehicleType, timeAgo } from '../../utils/helpers';
import { subscribeToRegistrations, processRegistrationAction } from '../../services';

interface ServiceRegistrationPageProps {
    role: Role;
}

const ServiceRegistrationPage: React.FC<ServiceRegistrationPageProps> = ({ role }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    
    // --- Data State ---
    const [registrations, setRegistrations] = useState<ServiceRegistration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- UI States ---
    const [activeTab, setActiveTab] = useState<RegistrationType>('Construction');
    const [statusFilter, setStatusFilter] = useState<RegistrationStatus | 'All'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [reviewItem, setReviewItem] = useState<ServiceRegistration | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<{name: string, url: string} | null>(null);

    // 1. Logic: Listen to Firestore
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = subscribeToRegistrations((data) => {
            setRegistrations(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Logic: Data Filtering
    const filteredData = useMemo(() => {
        return registrations.filter(item => {
            if (item.type !== activeTab) return false;
            if (statusFilter !== 'All' && item.status !== statusFilter) return false;
            if (searchTerm && !item.residentId.includes(searchTerm)) return false;
            return true;
        });
    }, [registrations, activeTab, statusFilter, searchTerm]);

    // 3. Logic: Stats Calculation
    const stats = useMemo(() => {
        const tabData = registrations.filter(r => r.type === activeTab);
        return {
            total: tabData.length,
            pending: tabData.filter(r => r.status === 'Pending').length,
            approved: tabData.filter(r => r.status === 'Approved').length,
            rejected: tabData.filter(r => r.status === 'Rejected').length,
        };
    }, [registrations, activeTab]);

    const handleAction = async (id: string, action: RegistrationStatus) => {
        if (!reviewItem) return;
        
        if (action === 'Rejected' && !adminNote.trim()) {
            showToast('Vui lòng nhập lý do từ chối vào ô phản hồi.', 'warn');
            return;
        }
        
        setIsProcessing(true);
        try {
            await processRegistrationAction(
                id, 
                action, 
                adminNote.trim(), 
                user?.Email || 'system',
                reviewItem.residentId
            );
            showToast(`Đã ${action === 'Approved' ? 'duyệt' : 'từ chối'} yêu cầu căn ${reviewItem.residentId}`, 'success');
            setReviewItem(null);
            setAdminNote('');
        } catch (error) {
            showToast('Lỗi khi cập nhật trạng thái.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const statusBadge = (status: RegistrationStatus) => {
        switch (status) {
            case 'Pending': return <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><ClockIcon className="w-3 h-3"/> CHỜ XỬ LÝ</span>;
            case 'Approved': return <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> ĐÃ DUYỆT</span>;
            case 'Rejected': return <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><XMarkIcon className="w-3 h-3"/> TỪ CHỐI</span>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-down h-full flex flex-col">
            <style>{`
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); transform: scale(1); }
                    70% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); transform: scale(1.05); }
                    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); transform: scale(1); }
                }
                .btn-glow {
                    animation: pulse-glow 2s infinite;
                }
            `}</style>
            
            {/* 1. Stat Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => setStatusFilter('All')} className="cursor-pointer">
                    <StatCard 
                        label="Tất cả đơn" 
                        value={stats.total} 
                        icon={<ClipboardCheckIcon className="w-6 h-6 text-blue-600"/>} 
                        className={`border-l-4 border-blue-500 transition-all ${statusFilter === 'All' ? 'ring-2 ring-blue-500 bg-blue-50/30 shadow-md' : 'hover:bg-gray-50'}`} 
                        iconBgClass="bg-blue-100" 
                    />
                </div>
                <div onClick={() => setStatusFilter('Pending')} className="cursor-pointer">
                    <StatCard 
                        label="Chờ xử lý" 
                        value={stats.pending} 
                        icon={<ClockIcon className="w-6 h-6 text-amber-600"/>} 
                        className={`border-l-4 border-amber-500 transition-all ${statusFilter === 'Pending' ? 'ring-2 ring-amber-500 bg-amber-50/30 shadow-md' : 'hover:bg-gray-50'}`} 
                        iconBgClass="bg-amber-100" 
                    />
                </div>
                <div onClick={() => setStatusFilter('Approved')} className="cursor-pointer">
                    <StatCard 
                        label="Đã phê duyệt" 
                        value={stats.approved} 
                        icon={<CheckCircleIcon className="w-6 h-6 text-emerald-600"/>} 
                        className={`border-l-4 border-emerald-500 transition-all ${statusFilter === 'Approved' ? 'ring-2 ring-emerald-500 bg-emerald-50/30 shadow-md' : 'hover:bg-gray-50'}`} 
                        iconBgClass="bg-emerald-100" 
                    />
                </div>
                <div onClick={() => setStatusFilter('Rejected')} className="cursor-pointer">
                    <StatCard 
                        label="Đã từ chối" 
                        value={stats.rejected} 
                        icon={<XMarkIcon className="w-6 h-6 text-rose-600"/>} 
                        className={`border-l-4 border-rose-500 transition-all ${statusFilter === 'Rejected' ? 'ring-2 ring-rose-500 bg-rose-50/30 shadow-md' : 'hover:bg-gray-50'}`} 
                        iconBgClass="bg-rose-100" 
                    />
                </div>
            </div>

            {/* 2. Filters & Toolbar Bar */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 items-center">
                <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto border border-gray-200 shadow-inner">
                    <button onClick={() => setActiveTab('Construction')} className={`flex-1 lg:w-40 py-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'Construction' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                        <HammerIcon className="w-4 h-4" /> THI CÔNG
                    </button>
                    <button onClick={() => setActiveTab('Vehicle')} className={`flex-1 lg:w-40 py-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'Vehicle' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                        <CarIcon className="w-4 h-4" /> PHƯƠNG TIỆN
                    </button>
                </div>

                <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Tìm mã căn hộ..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm focus:ring-4 focus:ring-primary/5 transition-all font-bold"
                    />
                </div>

                <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="w-full lg:w-56 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black outline-none cursor-pointer focus:bg-white"
                >
                    <option value="All">Tất cả trạng thái</option>
                    <option value="Pending">Chờ xét duyệt</option>
                    <option value="Approved">Đã phê duyệt</option>
                    <option value="Rejected">Đã từ chối</option>
                </select>
            </div>

            {/* 3. Table Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><Spinner /></div>
                ) : (
                    <div className="overflow-y-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-b sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Căn hộ</th>
                                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">
                                        {activeTab === 'Construction' ? 'Nội dung thi công' : 'Loại xe / Biển số'}
                                    </th>
                                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">
                                        Thời gian nhận
                                    </th>
                                    <th className="px-6 py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px]">Trạng thái</th>
                                    <th className="px-6 py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px]">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-xs border border-primary/10 shadow-inner">
                                                    {item.residentId}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                    {new Date(item.date).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {activeTab === 'Construction' ? (
                                                <div className="max-w-xs">
                                                    <p className="font-bold text-gray-800 truncate">{item.details.constructionItem}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.details.contractor}</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-black text-gray-900 bg-gray-100 px-3 py-1 rounded border border-gray-200 tracking-tight uppercase shadow-sm">
                                                        {item.details.plate}
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                        {item.details.model}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 font-bold text-xs">
                                            {timeAgo(item.date)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {statusBadge(item.status)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => {
                                                    setReviewItem(item);
                                                    setAdminNote(item.rejectionReason || '');
                                                }}
                                                className={`p-2.5 rounded-xl transition-all active:scale-90 border shadow-sm ${
                                                    item.status === 'Pending' 
                                                        ? 'bg-orange-600 text-white border-orange-700 btn-glow' 
                                                        : 'bg-white text-gray-400 border-gray-100 hover:text-primary hover:border-primary/20'
                                                }`}
                                            >
                                                {/* Fixed error: strokeWidth is not a valid prop for CheckIcon wrapper */}
                                                {item.status === 'Pending' ? <CheckIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <WarningIcon className="w-12 h-12" />
                                                <p className="font-black uppercase tracking-widest text-xs">Không tìm thấy yêu cầu đăng ký nào.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {reviewItem && (
                <Modal title={`Hồ sơ đăng ký: Căn ${reviewItem.residentId}`} onClose={() => setReviewItem(null)} size="2xl">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-primary border border-gray-100 font-black text-lg">
                                    {reviewItem.residentId}
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">Căn hộ {reviewItem.residentId}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{reviewItem.type === 'Construction' ? 'Đăng ký thi công' : 'Đăng ký gửi xe'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {statusBadge(reviewItem.status)}
                                <p className="text-[10px] font-black text-gray-300 mt-2 uppercase tracking-widest">{new Date(reviewItem.date).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-5">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                    <InformationCircleIcon className="w-4 h-4 text-blue-500" /> Chi tiết thông tin
                                </h4>
                                <div className="space-y-4 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                                    {reviewItem.type === 'Construction' ? (
                                        <>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-1">Hạng mục</label><p className="text-sm font-black text-gray-800 leading-tight">{reviewItem.details.constructionItem}</p></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-1">Thời gian</label><p className="text-sm font-bold text-gray-700">{reviewItem.details.constructionTime}</p></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-1">Đơn vị thầu</label><p className="text-sm font-bold text-gray-700">{reviewItem.details.contractor}</p></div>
                                            <div className="pt-3 border-t border-dashed"><label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">Mô tả công việc</label><p className="text-xs text-gray-600 leading-relaxed italic">"{reviewItem.details.description || 'Không có mô tả thêm'}"</p></div>
                                        </>
                                    ) : (
                                        <>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-1">Loại xe</label><p className="text-sm font-black text-gray-800 uppercase tracking-tight">{translateVehicleType(reviewItem.details.vehicleType as any)}</p></div>
                                            <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-1">Biển số</label><p className="text-2xl font-mono font-black text-primary tracking-tighter uppercase">{reviewItem.details.plate}</p></div>
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                                                <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-0.5">Dòng xe</label><p className="text-xs font-black text-gray-700 uppercase">{reviewItem.details.model}</p></div>
                                                <div><label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest mb-0.5">Màu sắc</label><p className="text-xs font-black text-gray-700 uppercase">{reviewItem.details.color}</p></div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                    <CloudArrowUpIcon className="w-4 h-4 text-purple-500" /> Tài liệu đính kèm
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {reviewItem.documents && reviewItem.documents.length > 0 ? reviewItem.documents.map((doc, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => setPreviewDoc(doc)}
                                            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group relative overflow-hidden shadow-sm"
                                        >
                                            {doc.url.startsWith('data:image') || doc.url.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ? (
                                                <img src={doc.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={doc.name} />
                                            ) : (
                                                <>
                                                    <FileTextIcon className="w-8 h-8 group-hover:text-primary transition-colors" />
                                                    <span className="text-[8px] font-black uppercase text-center px-2 line-clamp-1">{doc.name}</span>
                                                </>
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                <EyeIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-2 py-10 text-center text-gray-300 italic text-[10px] font-black uppercase tracking-widest border-2 border-dashed rounded-3xl">Không có tài liệu đính kèm.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {reviewItem.status === 'Pending' && (
                            <div className="mt-6 border-t pt-6 bg-amber-50/30 p-5 rounded-[2rem] border border-dashed border-amber-200">
                                <label className="block text-[10px] font-black text-amber-800 uppercase tracking-widest mb-3">
                                    Phản hồi từ Ban Quản Lý <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full p-4 border border-amber-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none text-sm shadow-inner bg-white font-medium placeholder:text-gray-300"
                                    placeholder="Hướng dẫn bổ sung hồ sơ hoặc lý do từ chối..."
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Modal Actions */}
                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                            {reviewItem.status === 'Pending' ? (
                                <>
                                    <button 
                                        onClick={() => handleAction(reviewItem.id, 'Rejected')}
                                        disabled={isProcessing}
                                        className="px-8 py-3.5 border-2 border-rose-500 text-rose-600 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <XMarkIcon className="w-4 h-4" /> TỪ CHỐI
                                    </button>
                                    <button 
                                        onClick={() => handleAction(reviewItem.id, 'Approved')}
                                        disabled={isProcessing}
                                        className="px-10 py-3.5 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95 ring-2 ring-emerald-500/20"
                                    >
                                        {isProcessing ? <Spinner /> : <><CheckCircleIcon className="w-4 h-4" /> PHÊ DUYỆT</>}
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setReviewItem(null)} className="px-12 py-3.5 bg-gray-100 text-gray-500 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:bg-gray-200 transition-all">ĐÓNG</button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <Modal title={`Tài liệu: ${previewDoc.name}`} onClose={() => setPreviewDoc(null)} size="4xl">
                    <div className="flex flex-col items-center p-3 bg-gray-50 rounded-[2rem] overflow-hidden min-h-[50vh]">
                        {previewDoc.url.startsWith('data:image') || previewDoc.url.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ? (
                            <img src={previewDoc.url} className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-3xl border-4 border-white" alt={previewDoc.name} />
                        ) : previewDoc.url.toLowerCase().includes('pdf') || previewDoc.url.startsWith('data:application/pdf') ? (
                            <iframe src={previewDoc.url} className="w-full h-[75vh] border-0 rounded-3xl shadow-sm" title={previewDoc.name}></iframe>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-gray-300 gap-5">
                                <FileTextIcon className="w-24 h-24 opacity-20" />
                                <p className="font-black text-gray-400 uppercase tracking-widest">Định dạng file này cần tải về để xem</p>
                                <a 
                                    href={previewDoc.url} 
                                    download={previewDoc.name}
                                    className="px-8 py-3 bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                >
                                    <DocumentArrowDownIcon className="w-5 h-5" /> TẢI VỀ MÁY
                                </a>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ServiceRegistrationPage;
