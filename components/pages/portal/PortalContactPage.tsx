
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification, useAuth } from '../../../App';
import type { FeedbackItem, Owner, Unit, ServiceRegistration } from '../../../types';
import { 
    ChatBubbleLeftEllipsisIcon, PhoneArrowUpRightIcon, InformationCircleIcon, 
    DocumentTextIcon, CheckCircleIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon,
    ArrowPathIcon, InboxIcon, WrenchIcon, ShieldCheckIcon, BanknotesIcon,
    CarIcon, MotorbikeIcon, BikeIcon, Camera, ChevronLeftIcon, HammerIcon,
    FileTextIcon, WarningIcon, CloudArrowUpIcon, XMarkIcon, TrashIcon
} from '../../ui/Icons';
import { submitFeedback, submitServiceRegistration } from '../../../services';
import Spinner from '../../ui/Spinner';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { timeAgo, compressImageToWebP } from '../../../utils/helpers';

interface PortalContactPageProps {
    hotline: string;
    onSubmitFeedback: (item: FeedbackItem) => void;
    owner: Owner | null;
    unit: Unit | null;
}

type TabType = 'feedback' | 'registration';
type RegType = 'moto' | 'car' | 'construction' | null;

const statusConfig: Record<string, { label: string, color: string, icon: React.ReactNode }> = {
    Pending: { label: 'Đang chờ', color: 'border-amber-400 text-amber-700 bg-amber-50', icon: <ClockIcon className="w-3 h-3" /> },
    Processing: { label: 'Đang xử lý', color: 'border-blue-500 text-blue-700 bg-blue-50', icon: <ArrowPathIcon className="w-3 h-3 animate-spin-slow" /> },
    Resolved: { label: 'Hoàn tất', color: 'border-emerald-500 text-emerald-700 bg-emerald-50', icon: <CheckCircleIcon className="w-3 h-3" /> },
    Approved: { label: 'Đã duyệt', color: 'border-emerald-500 text-emerald-700 bg-emerald-50', icon: <CheckCircleIcon className="w-3 h-3" /> },
    Rejected: { label: 'Từ chối', color: 'border-rose-500 text-rose-700 bg-rose-50', icon: <XMarkIcon className="w-3 h-3" /> },
};

const PortalContactPage: React.FC<PortalContactPageProps> = ({ hotline }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    
    // --- UI States ---
    const [activeTab, setActiveTab] = useState<TabType>('feedback');
    const [regType, setRegType] = useState<RegType>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [compressing, setCompressing] = useState<string | null>(null);

    // --- Media States ---
    const [fbImages, setFbImages] = useState<string[]>([]);
    const [regDocs, setRegDocs] = useState<Record<string, {name: string, url: string}>>({});

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

    // --- Unified History State ---
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = useCallback(async (silent = false) => {
        if (!user?.residentId) return;
        if (!silent) setIsRefreshing(true);
        try {
            /**
             * FIX: Loại bỏ orderBy và limit trong Query Firestore để tránh yêu cầu Composite Index.
             * Thay vào đó, chúng ta lấy tất cả yêu cầu của cư dân này (thường không quá nhiều)
             * rồi thực hiện sắp xếp và giới hạn ngay tại trình duyệt.
             */
            const qFb = query(
                collection(db, 'feedback'), 
                where('residentId', '==', user.residentId)
            );
            const qReg = query(
                collection(db, 'service_registrations'), 
                where('residentId', '==', user.residentId)
            );

            const [snapFb, snapReg] = await Promise.all([getDocs(qFb), getDocs(qReg)]);
            
            const fbItems = snapFb.docs.map(doc => ({ id: doc.id, ...doc.data(), _type: 'feedback' }));
            const regItems = snapReg.docs.map(doc => ({ id: doc.id, ...doc.data(), _type: 'registration' }));

            // Hợp nhất, sắp xếp Giảm dần theo ngày và lấy 10 mục mới nhất
            const merged = [...fbItems, ...regItems].sort((a: any, b: any) => 
                new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
            ).slice(0, 10);

            setHistory(merged);
        } catch (error) {
            console.error("Fetch History Error:", error);
            showToast('Không thể tải lịch sử yêu cầu.', 'error');
        } finally {
            setIsRefreshing(false);
        }
    }, [user?.residentId, showToast]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // --- Media Handlers ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotId: string, isFeedback: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCompressing(slotId);
        try {
            const compressedBase64 = await compressImageToWebP(file);
            if (isFeedback) {
                setFbImages(prev => [...prev, compressedBase64]);
            } else {
                setRegDocs(prev => ({
                    ...prev,
                    [slotId]: { name: file.name, url: compressedBase64 }
                }));
            }
            showToast('Đã nén và tải ảnh thành công', 'success');
        } catch (err) {
            showToast('Lỗi khi xử lý hình ảnh', 'error');
        } finally {
            setCompressing(null);
            if (e.target) e.target.value = '';
        }
    };

    const removeFbImage = (index: number) => {
        setFbImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeRegDoc = (key: string) => {
        setRegDocs(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

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
                imageUrl: fbImages.length > 0 ? fbImages[0] : undefined,
                images: fbImages
            } as any);
            showToast('Gửi ý kiến thành công!', 'success');
            setFeedbackData({ subject: '', category: 'general', content: '' });
            setFbImages([]);
            fetchHistory(true);
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
            const isConstruction = regType === 'construction';
            
            const registrationData: Omit<ServiceRegistration, 'id'> = {
                residentId: user.residentId!,
                type: isConstruction ? 'Construction' : 'Vehicle',
                status: 'Pending',
                date: new Date().toISOString(),
                details: isConstruction ? {
                    constructionItem: regData.constructionItem,
                    constructionTime: regData.constructionTime,
                    contractor: regData.contractor,
                    description: regData.constructionDetail
                } : {
                    vehicleType: regType === 'car' ? 'car' : 'moto',
                    plate: regData.plate,
                    model: regData.model,
                    color: regData.color
                },
                documents: Object.values(regDocs)
            };

            await submitServiceRegistration(registrationData);

            showToast('Gửi đơn đăng ký thành công!', 'success');
            setRegType(null);
            setRegDocs({});
            setRegData({ plate: '', model: '', color: '', constructionItem: '', constructionTime: '', contractor: '', constructionDetail: '' });
            fetchHistory(true);
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

                        <div className="space-y-3">
                            <label className={labelStyle}>Hình ảnh đính kèm ({fbImages.length}/3)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {fbImages.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
                                        <img src={img} className="w-full h-full object-cover" alt="feedback" />
                                        <button 
                                            type="button" 
                                            onClick={() => removeFbImage(idx)}
                                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md"
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {fbImages.length < 3 && (
                                    <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                        {compressing === 'fb_add' ? (
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <Camera className="w-5 h-5" />
                                                <span className="text-[8px] font-black uppercase text-center">Thêm ảnh</span>
                                            </>
                                        )}
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*" 
                                            onChange={(e) => handleImageUpload(e, 'fb_add', true)} 
                                            disabled={!!compressing}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting || !!compressing} className="w-full py-4 bg-primary text-white font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-focus transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {isSubmitting ? <Spinner /> : 'GỬI Ý KIẾN'}
                        </button>
                    </form>
                ) : (
                    <div className="animate-fade-in-down">
                        {!regType ? (
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
                            <form onSubmit={handleRegSubmit} className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <button type="button" onClick={() => { setRegType(null); setRegDocs({}); }} className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest">
                                        <ChevronLeftIcon className="w-4 h-4" /> Quay lại
                                    </button>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Đăng ký {regType === 'construction' ? 'Thi công' : 'Gửi xe'}
                                    </span>
                                </div>

                                {regType === 'construction' ? (
                                    <>
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
                                            <div className="grid grid-cols-2 gap-3">
                                                {['Hồ sơ kỹ thuật', 'Ảnh hiện trạng'].map(key => (
                                                    <div key={key} className="relative">
                                                        {regDocs[key] ? (
                                                            <div className="relative aspect-video rounded-xl overflow-hidden border group">
                                                                <img src={regDocs[key].url} className="w-full h-full object-cover" alt={key} />
                                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button type="button" onClick={() => removeRegDoc(key)} className="p-2 bg-red-600 text-white rounded-full">
                                                                        <TrashIcon className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary active:bg-gray-100 transition-all cursor-pointer">
                                                                {compressing === key ? (
                                                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <>
                                                                        <CloudArrowUpIcon className="w-8 h-8 mb-1" />
                                                                        <span className="text-[8px] font-black uppercase">{key}</span>
                                                                    </>
                                                                )}
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, key, false)} disabled={!!compressing} />
                                                            </label>
                                                        )}
                                                    </div>
                                                ))}
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
                                            <label className={labelStyle}>Hình ảnh đính kèm (Yêu cầu)</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Ảnh CCCD', 'Đăng ký xe', 'Bìa Sổ Đỏ', 'Ảnh thực tế xe'].map(key => (
                                                    <div key={key} className="relative">
                                                        {regDocs[key] ? (
                                                            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border group">
                                                                <img src={regDocs[key].url} className="w-full h-full object-cover" alt={key} />
                                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button type="button" onClick={() => removeRegDoc(key)} className="p-2 bg-red-600 text-white rounded-full">
                                                                        <TrashIcon className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <label className="aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                                                {compressing === key ? (
                                                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <>
                                                                        <Camera className="w-5 h-5" />
                                                                        <span className="text-[8px] font-black uppercase text-center">{key}</span>
                                                                    </>
                                                                )}
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, key, false)} disabled={!!compressing} />
                                                            </label>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button type="submit" disabled={isSubmitting || !!compressing} className={`w-full py-4 text-white font-black uppercase rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${regType === 'construction' ? 'bg-orange-600 shadow-orange-100 hover:bg-orange-700' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'} disabled:opacity-50`}>
                                    {isSubmitting ? <Spinner /> : 'GỬI ĐĂNG KÝ'}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Request History Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <div className="h-px w-8 bg-gray-200"></div>
                        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Lịch sử yêu cầu</h2>
                        <div className="h-px flex-1 bg-gray-200 min-w-[20px]"></div>
                    </div>
                    <button 
                        onClick={() => fetchHistory()}
                        disabled={isRefreshing}
                        className="p-2 text-gray-400 hover:text-primary active:scale-90 transition-all rounded-lg"
                        title="Làm mới lịch sử"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {history.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                        {isRefreshing ? (
                            <div className="flex flex-col items-center gap-3">
                                <ArrowPathIcon className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-xs font-bold text-gray-400">Đang tải dữ liệu...</p>
                            </div>
                        ) : (
                            <>
                                <InboxIcon className="w-10 h-10 text-gray-200 mb-2" />
                                <p className="text-xs font-bold text-gray-400">Chưa có yêu cầu nào được ghi nhận</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => {
                            const isExpanded = expandedId === item.id;
                            const config = statusConfig[item.status] || statusConfig.Pending;
                            const isRegistration = item._type === 'registration';
                            
                            // Unified Item Header
                            const subject = isRegistration 
                                ? (item.type === 'Construction' ? `Thi công: ${item.details.constructionItem}` : `Đăng ký xe: ${item.details.plate}`)
                                : item.subject;
                            
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
                                            <p className="text-sm font-black text-gray-800 truncate">{subject}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
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
                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Thông tin đã gửi:</p>
                                                {isRegistration ? (
                                                    <div className="text-xs text-gray-700 space-y-1 font-medium">
                                                        {item.type === 'Construction' ? (
                                                            <>
                                                                <p><span className="text-gray-400">Hạng mục:</span> {item.details.constructionItem}</p>
                                                                <p><span className="text-gray-400">Đơn vị:</span> {item.details.contractor}</p>
                                                                <p><span className="text-gray-400">Thời gian:</span> {item.details.constructionTime}</p>
                                                                {item.details.description && <p className="mt-2 text-gray-500 italic">"{item.details.description}"</p>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p><span className="text-gray-400">Biển số:</span> {item.details.plate}</p>
                                                                <p><span className="text-gray-400">Dòng xe:</span> {item.details.model}</p>
                                                                <p><span className="text-gray-400">Màu:</span> {item.details.color}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                                )}

                                                {(item.images || item.documents) && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {(item.images || item.documents).map((doc: any, i: number) => (
                                                            <div key={i} className="w-16 h-12 rounded-lg border overflow-hidden bg-white shadow-sm">
                                                                <img src={doc.url || doc} className="w-full h-full object-cover" alt="attachment" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2">
                                                {isRegistration ? (
                                                    <div className="space-y-3">
                                                        {item.status === 'Approved' && (
                                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex gap-3 items-start">
                                                                <CheckCircleIcon className="text-emerald-600 shrink-0 mt-0.5 w-5 h-5" />
                                                                <div>
                                                                    <h4 className="font-black text-emerald-800 text-[10px] uppercase tracking-wider">Yêu cầu đã được duyệt</h4>
                                                                    <p className="text-sm text-emerald-800 mt-1 whitespace-pre-line font-medium leading-relaxed">
                                                                        {item.rejectionReason || "Ban Quản lý đã tiếp nhận và phê duyệt yêu cầu của bạn. Vui lòng liên hệ quầy dịch vụ nếu cần hỗ trợ thêm."}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.status === 'Rejected' && (
                                                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex gap-3 items-start">
                                                                <XMarkIcon className="text-rose-600 shrink-0 mt-0.5 w-5 h-5" />
                                                                <div>
                                                                    <h4 className="font-black text-rose-800 text-[10px] uppercase tracking-wider">Yêu cầu bị từ chối</h4>
                                                                    <p className="text-sm text-rose-800 mt-1 whitespace-pre-line font-medium leading-relaxed font-bold">
                                                                        Lý do: {item.rejectionReason || "Hồ sơ chưa đầy đủ hoặc không hợp lệ theo quy định."}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.status === 'Pending' && (
                                                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                                                <ClockIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                                <p className="text-xs text-gray-500 italic font-bold">Hồ sơ đang được BQL thẩm định...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {item.replies && item.replies.length > 0 ? (
                                                            <>
                                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest px-1">Phản hồi từ BQL:</p>
                                                                {item.replies.map((reply: any, idx: number) => (
                                                                    <div key={idx} className="bg-emerald-50/50 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border border-emerald-100 shadow-sm">
                                                                        <p className="text-xs text-gray-800 font-semibold">{reply.content}</p>
                                                                        <p className="text-[9px] text-emerald-600 font-bold mt-1.5 uppercase tracking-tighter">{timeAgo(reply.date)}</p>
                                                                    </div>
                                                                ))}
                                                            </>
                                                        ) : (
                                                            <p className="text-[10px] text-gray-400 italic text-center py-2">Chưa có phản hồi từ BQL</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
