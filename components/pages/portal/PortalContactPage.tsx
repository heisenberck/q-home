
import React, { useState, useEffect } from 'react';
import { useNotification, useAuth } from '../../../App';
import type { FeedbackItem, Owner, Unit } from '../../../types';
import { 
    ChatBubbleLeftEllipsisIcon, PhoneArrowUpRightIcon, InformationCircleIcon, 
    DocumentTextIcon, CheckCircleIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon,
    ArrowPathIcon, InboxIcon, WrenchIcon, ShieldCheckIcon, BanknotesIcon,
    CarIcon, MotorbikeIcon, BikeIcon, Camera, ChevronLeftIcon, HammerIcon,
    FileTextIcon, WarningIcon, CloudArrowUpIcon
} from '../../ui/Icons';
import { submitFeedback } from '../../../services';
import Spinner from '../../ui/Spinner';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { timeAgo } from '../../../utils/helpers';

interface PortalContactPageProps {
    hotline: string;
    onSubmitFeedback: (item: FeedbackItem) => void;
    owner: Owner | null;
    unit: Unit | null;
}

type TabType = 'feedback' | 'registration';
type RegType = 'moto' | 'car' | 'construction' | null;

const statusConfig = {
    Pending: { label: 'Đang chờ', color: 'border-amber-400 text-amber-700 bg-amber-50', icon: <ClockIcon className="w-3 h-3" /> },
    Processing: { label: 'Đang xử lý', color: 'border-blue-500 text-blue-700 bg-blue-50', icon: <ArrowPathIcon className="w-3 h-3 animate-spin-slow" /> },
    Resolved: { label: 'Hoàn tất', color: 'border-emerald-500 text-emerald-700 bg-emerald-50', icon: <CheckCircleIcon className="w-3 h-3" /> },
};

const categoryLabels: Record<string, string> = {
    general: 'Góp ý chung',
    maintenance: 'Kỹ thuật',
    security: 'An ninh',
    hygiene: 'Vệ sinh',
    vehicle_reg: 'Đăng ký xe',
    construction: 'Thi công',
    other: 'Khác'
};

const PortalContactPage: React.FC<PortalContactPageProps> = ({ hotline }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    
    // --- UI States ---
    const [activeTab, setActiveTab] = useState<TabType>('feedback');
    const [regType, setRegType] = useState<RegType>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // --- Form States ---
    const [feedbackData, setFeedbackData] = useState({
        subject: '',
        category: 'general' as FeedbackItem['category'],
        content: ''
    });

    const [regData, setRegData] = useState({
        plate: '',
        model: '',
        color: '',
        constructionItem: '',
        constructionTime: '',
        contractor: '',
        constructionDetail: ''
    });

    // --- History State ---
    const [history, setHistory] = useState<FeedbackItem[]>([]);

    useEffect(() => {
        if (!user?.residentId) return;
        const q = query(collection(db, 'feedback'), where('residentId', '==', user.residentId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackItem));
            setHistory(items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
        return () => unsubscribe();
    }, [user?.residentId]);

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackData.subject.trim() || !feedbackData.content.trim()) {
            showToast('Vui lòng nhập đầy đủ thông tin.', 'warn');
            return;
        }
        setIsSubmitting(true);
        try {
            await submitFeedback({
                residentId: user.residentId!,
                ...feedbackData,
                status: 'Pending',
                date: new Date().toISOString(),
                replies: [],
            });
            showToast('Gửi ý kiến thành công!', 'success');
            setFeedbackData({ subject: '', category: 'general', content: '' });
        } catch {
            showToast('Lỗi khi gửi phản hồi.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const subject = regType === 'construction' 
                ? `Đăng ký thi công: ${regData.constructionItem}`
                : `Đăng ký ${regType === 'car' ? 'Ô tô' : 'Xe máy'}: ${regData.plate}`;
            
            const content = regType === 'construction'
                ? `Đơn vị: ${regData.contractor}. Thời gian: ${regData.constructionTime}. Chi tiết: ${regData.constructionDetail}`
                : `Dòng xe: ${regData.model}. Màu: ${regData.color}`;

            await submitFeedback({
                residentId: user.residentId!,
                subject,
                category: regType === 'construction' ? 'other' : 'vehicle_reg',
                content,
                status: 'Pending',
                date: new Date().toISOString(),
                replies: [],
            });
            showToast('Gửi đơn đăng ký thành công!', 'success');
            setRegType(null);
            setRegData({ plate: '', model: '', color: '', constructionItem: '', constructionTime: '', contractor: '', constructionDetail: '' });
        } catch {
            showToast('Lỗi khi gửi đăng ký.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyle = "w-full p-3 border rounded-xl bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm";
    const labelStyle = "font-black text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block";

    return (
        <div className="p-4 space-y-6 pb-24">
            {/* 1. Header & Hotline */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-black text-gray-800 text-sm uppercase tracking-tight flex items-center gap-2">
                        <InformationCircleIcon className="w-5 h-5 text-blue-500" />
                        Liên hệ & Hỗ trợ
                    </h2>
                </div>
                <a href={`tel:${hotline}`} className="w-full flex items-center justify-center gap-3 p-3.5 bg-red-600 text-white font-black rounded-xl text-base shadow-lg shadow-red-100 active:scale-95 transition-all">
                    <PhoneArrowUpRightIcon className="w-5 h-5" />
                    HOTLINE BQL: {hotline}
                </a>
            </div>

            {/* 2. Tab Switcher */}
            <div className="flex bg-gray-200/60 p-1 rounded-2xl">
                <button 
                    onClick={() => setActiveTab('feedback')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'feedback' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}
                >
                    <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> Gửi Ý kiến
                </button>
                <button 
                    onClick={() => setActiveTab('registration')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'registration' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}
                >
                    <DocumentTextIcon className="w-4 h-4" /> Đăng ký Dịch vụ
                </button>
            </div>
            
            {/* 3. Dynamic Form Area */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 min-h-[320px]">
                {activeTab === 'feedback' ? (
                    /* TAB A: FEEDBACK (GỬI Ý KIẾN) */
                    <form onSubmit={handleFeedbackSubmit} className="space-y-5 animate-fade-in-down">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <ClockIcon className="w-4 h-4" /> Gửi ý kiến
                        </h3>
                        <div>
                            <label className={labelStyle}>Hạng mục</label>
                            <select 
                                value={feedbackData.category} 
                                onChange={e => setFeedbackData({...feedbackData, category: e.target.value as any})}
                                className={`${inputStyle} font-bold text-gray-800`}
                            >
                                <option value="general">Góp ý chung</option>
                                <option value="maintenance">Sửa chữa / Kỹ thuật</option>
                                <option value="security">An ninh / Trật tự</option>
                                <option value="hygiene">Vệ sinh / Cảnh quan</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Tiêu đề</label>
                            <input 
                                value={feedbackData.subject} 
                                onChange={e => setFeedbackData({...feedbackData, subject: e.target.value})}
                                className={inputStyle} 
                                placeholder="Tóm tắt vấn đề..." 
                                required 
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Nội dung chi tiết</label>
                            <textarea 
                                value={feedbackData.content} 
                                onChange={e => setFeedbackData({...feedbackData, content: e.target.value})}
                                rows={4} 
                                className={inputStyle} 
                                placeholder="Vui lòng mô tả chi tiết để BQL hỗ trợ tốt nhất..." 
                                required 
                            />
                        </div>

                        {/* Upload Hình ảnh cho Gửi ý kiến */}
                        <div className="space-y-3">
                            <label className={labelStyle}>Hình ảnh đính kèm (nếu có)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(slot => (
                                    <div key={slot} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                        <Camera className="w-5 h-5" />
                                        <span className="text-[8px] font-black uppercase text-center">Tải ảnh {slot}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-primary text-white font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-focus transition-all flex items-center justify-center gap-2">
                            {isSubmitting ? <Spinner /> : 'GỬI Ý KIẾN'}
                        </button>
                    </form>
                ) : (
                    /* TAB B: REGISTRATION */
                    <div className="animate-fade-in-down">
                        {!regType ? (
                            /* Step 1: Selection Grid */
                            <div className="space-y-5">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Chọn dịch vụ đăng ký</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <button onClick={() => setRegType('moto')} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left group">
                                        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:text-primary"><BikeIcon className="w-6 h-6" /></div>
                                        <div><p className="font-black text-gray-800 text-sm">Đăng ký Xe máy / Xe điện</p><p className="text-[10px] text-gray-400 uppercase font-bold">Thủ tục cấp thẻ xe mới</p></div>
                                    </button>
                                    <button onClick={() => setRegType('car')} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left group">
                                        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:text-primary"><CarIcon className="w-6 h-6" /></div>
                                        <div><p className="font-black text-gray-800 text-sm">Đăng ký Ô tô</p><p className="text-[10px] text-gray-400 uppercase font-bold">Thủ tục gửi xe ô tô tại hầm</p></div>
                                    </button>
                                    <button onClick={() => setRegType('construction')} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left group">
                                        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:text-primary"><HammerIcon className="w-6 h-6" /></div>
                                        <div><p className="font-black text-gray-800 text-sm">Đăng ký Thi công / Sửa chữa</p><p className="text-[10px] text-gray-400 uppercase font-bold">Cấp phép cải tạo căn hộ</p></div>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Step 2: Dynamic Form */
                            <form onSubmit={handleRegSubmit} className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <button type="button" onClick={() => setRegType(null)} className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest">
                                        <ChevronLeftIcon className="w-4 h-4" /> Quay lại
                                    </button>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Đăng ký {regType === 'construction' ? 'Thi công' : 'Gửi xe'}
                                    </span>
                                </div>

                                {regType === 'construction' ? (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-black text-gray-800 text-xs uppercase tracking-tight">Thông tin thi công</h3>
                                            <button 
                                                type="button" 
                                                onClick={() => alert("Chức năng đang phát triển: Xem quy định thi công tại tòa nhà.")}
                                                className="text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline transition-all"
                                            >
                                                <FileTextIcon className="w-3 h-3" /> Xem quy định
                                            </button>
                                        </div>

                                        <div>
                                            <label className={labelStyle}>Hạng mục thi công chính</label>
                                            <input 
                                                value={regData.constructionItem} 
                                                onChange={e => setRegData({...regData, constructionItem: e.target.value})} 
                                                className={inputStyle} 
                                                placeholder="VD: Sơn lại tường, Lát sàn gỗ..." 
                                                required 
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelStyle}>Thời gian dự kiến</label>
                                                <input 
                                                    value={regData.constructionTime} 
                                                    onChange={e => setRegData({...regData, constructionTime: e.target.value})} 
                                                    className={inputStyle} 
                                                    placeholder="Từ ngày ... đến ngày ..." 
                                                    required 
                                                />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Đơn vị thực hiện</label>
                                                <input 
                                                    value={regData.contractor} 
                                                    onChange={e => setRegData({...regData, contractor: e.target.value})} 
                                                    className={inputStyle} 
                                                    placeholder="Tên công ty hoặc tổ thợ..." 
                                                    required 
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelStyle}>Chi tiết nội dung thi công</label>
                                            <textarea 
                                                value={regData.constructionDetail} 
                                                onChange={e => setRegData({...regData, constructionDetail: e.target.value})} 
                                                rows={3} 
                                                className={inputStyle} 
                                                placeholder="Mô tả chi tiết các hạng mục (Vd: Lát sàn, sơn tường, đập thông phòng...)" 
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className={labelStyle}>Tài liệu đính kèm (Bản vẽ kỹ thuật/Hồ sơ)</label>
                                            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50 active:bg-gray-100 transition-all cursor-pointer group hover:border-primary">
                                                <CloudArrowUpIcon className="w-8 h-8 mb-2 group-hover:text-primary transition-colors" />
                                                <span className="text-xs font-bold uppercase">Nhấn để tải lên file (PDF, Ảnh)</span>
                                            </div>
                                        </div>

                                        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl">
                                            <div className="flex gap-3">
                                                <WarningIcon className="text-orange-500 shrink-0 w-5 h-5" />
                                                <div className="text-xs text-orange-800 leading-relaxed">
                                                    <span className="font-black block mb-1 uppercase tracking-widest text-[10px]">Lưu ý quan trọng:</span>
                                                    Đăng ký online chỉ là bước thông báo ban đầu. Quý cư dân vui lòng liên hệ trực tiếp tại <b>Văn phòng Ban Quản lý</b> để hoàn thiện hồ sơ, đặt cọc (nếu có) và nhận Giấy phép thi công trước khi bắt đầu.
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className={labelStyle}>Biển số xe</label><input value={regData.plate} onChange={e => setRegData({...regData, plate: e.target.value})} className={inputStyle} placeholder="VD: 30A-123.45" required /></div>
                                            <div><label className={labelStyle}>Màu xe</label><input value={regData.color} onChange={e => setRegData({...regData, color: e.target.value})} className={inputStyle} placeholder="VD: Trắng, Đen..." required /></div>
                                        </div>
                                        <div><label className={labelStyle}>Loại xe (Model)</label><input value={regData.model} onChange={e => setRegData({...regData, model: e.target.value})} className={inputStyle} placeholder="VD: Honda Vision, Mazda 3..." required /></div>
                                        
                                        <div className="space-y-3">
                                            <label className={labelStyle}>Hình ảnh đính kèm để xác thực</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Ảnh CCCD', 'Đăng ký xe', 'Bìa Sổ Đỏ', 'Ảnh thực tế xe'].map(box => (
                                                    <div key={box} className="aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                                        <Camera className="w-5 h-5" />
                                                        <span className="text-[8px] font-black uppercase text-center">{box}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-gray-400 italic">* Yêu cầu upload bìa Sổ Đỏ để xác nhận chính chủ khi đăng ký gửi ô tô.</p>
                                        </div>
                                    </>
                                )}

                                <button type="submit" disabled={isSubmitting} className={`w-full py-4 text-white font-black uppercase rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${regType === 'construction' ? 'bg-orange-600 shadow-orange-100 hover:bg-orange-700' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'}`}>
                                    {isSubmitting ? <Spinner /> : 'GỬI ĐĂNG KÝ'}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Request History Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-gray-200"></div>
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Lịch sử yêu cầu</h2>
                    <div className="h-px flex-1 bg-gray-200"></div>
                </div>

                {history.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                        <InboxIcon className="w-10 h-10 text-gray-200 mb-2" />
                        <p className="text-xs font-bold text-gray-400">Chưa có yêu cầu nào được ghi nhận</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => {
                            const isExpanded = expandedId === item.id;
                            const config = statusConfig[item.status] || statusConfig.Pending;
                            const isRegistration = item.category === 'vehicle_reg' || item.subject.toLowerCase().includes('đăng ký');
                            
                            return (
                                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <button 
                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                        className="w-full p-4 flex items-center justify-between text-left active:bg-gray-50 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${isRegistration ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                                    {isRegistration ? 'Đăng ký' : 'Ý kiến'}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-300">#{item.id.slice(-4).toUpperCase()}</span>
                                            </div>
                                            <p className="text-sm font-black text-gray-800 truncate">{item.subject}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                                                <span className="text-[9px] text-gray-300">•</span>
                                                <span className={`flex items-center gap-1 text-[9px] font-black uppercase ${config.color.split(' ')[1]}`}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 ml-4 text-gray-300">
                                            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 animate-fade-in-down space-y-4">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Nội dung đã gửi:</p>
                                                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                            </div>

                                            {item.replies && item.replies.length > 0 && (
                                                <div className="space-y-3 pt-2 border-t border-dashed border-gray-100">
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Phản hồi từ BQL:</p>
                                                    {item.replies.map((reply, idx) => (
                                                        <div key={idx} className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                                            <p className="text-xs text-gray-800 font-semibold">{reply.content}</p>
                                                            <p className="text-[9px] text-emerald-600 font-bold mt-1.5 uppercase tracking-tighter">{timeAgo(reply.date)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PortalContactPage;
