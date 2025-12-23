
import React, { useState, useEffect, useRef } from 'react';
import { useNotification, useAuth } from '../../../App';
import type { FeedbackItem, Owner, Unit } from '../../../types';
import { 
    ChatBubbleLeftEllipsisIcon, PhoneArrowUpRightIcon, InformationCircleIcon, 
    WarningIcon, DocumentTextIcon, UploadIcon, XMarkIcon, CheckCircleIcon,
    CarIcon, MotorbikeIcon
} from '../../ui/Icons';

interface PortalContactPageProps {
    hotline: string;
    onSubmitFeedback: (item: FeedbackItem) => void;
    owner: Owner | null;
    unit: Unit | null;
}

interface UploadSlot {
    id: string;
    label: string;
    file: File | null;
}

const PortalContactPage: React.FC<PortalContactPageProps> = ({ hotline, onSubmitFeedback, owner, unit }) => {
    const { showToast } = useNotification();
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<FeedbackItem['category']>('general');
    const [content, setContent] = useState('');
    
    // State for vehicle registration sub-type
    const [regVehicleType, setRegVehicleType] = useState<'car' | 'bike'>('bike');
    
    // Slots for dynamic file uploads
    const [slots, setSlots] = useState<UploadSlot[]>([]);

    // --- Dynamic Upload Slots Configuration ---
    useEffect(() => {
        if (category === 'vehicle_reg') {
            if (regVehicleType === 'bike') {
                setSlots([
                    { id: 'cccd', label: 'CCCD mặt trước', file: null },
                    { id: 'reg', label: 'Đăng ký xe', file: null },
                    { id: 'photo', label: 'Ảnh thực tế xe', file: null }
                ]);
            } else {
                setSlots([
                    { id: 'title', label: 'Sổ đỏ / HĐ mua bán', file: null },
                    { id: 'cccd', label: 'CCCD mặt trước', file: null },
                    { id: 'reg', label: 'Đăng ký xe', file: null },
                    { id: 'photo', label: 'Ảnh thực tế xe', file: null }
                ]);
            }
        } else {
            setSlots([]); // Reset for other categories
        }
    }, [category, regVehicleType]);

    // --- Generate Vehicle Registration Template ---
    useEffect(() => {
        if (category === 'vehicle_reg') {
            setSubject(`Đăng ký gửi ${regVehicleType === 'car' ? 'Ô tô' : 'Xe máy/Điện'} mới`);
            
            const today = new Date().toLocaleDateString('vi-VN');
            const statusLabel = unit?.Status === 'Owner' ? 'Chính chủ' : unit?.Status === 'Rent' ? 'Người thuê' : 'Kinh doanh';
            
            const template = `ĐƠN ĐĂNG KÝ GỬI PHƯƠNG TIỆN

Kính gửi: Ban Quản lý Vận hành

Tôi tên là: ${owner?.OwnerName || '(Hệ thống tự điền)'}
Số điện thoại: ${owner?.Phone || '(Hệ thống tự điền)'}
Căn hộ số: ${unit?.UnitID || user.residentId} Tình trạng căn hộ: ${statusLabel}

Nay tôi làm đơn này kính đề nghị Ban Quản lý cho phép đăng ký gửi xe tại khu vực để xe của chung cư, với thông tin như sau:

Loại xe: ${regVehicleType === 'car' ? 'Ô tô' : 'Xe máy / Xe điện'} ........................

Biển kiểm soát: ......................................................

Chính chủ: Có/Không

Tôi cam kết chấp hành đầy đủ các quy định về quản lý, trông giữ xe của Ban Quản lý Vận hành và chịu hoàn toàn trách nhiệm về tính chính xác của các thông tin đã kê khai trên.

Kính mong Ban Quản lý xem xét và tạo điều kiện giải quyết.
Xin trân trọng cảm ơn!

Ngày ${today}

Người làm đơn
${owner?.OwnerName || '(Ghi rõ họ tên)'}`;
            
            setContent(template);
        } else if (subject.includes('Đăng ký gửi')) {
            setSubject('');
            setContent('');
        }
    }, [category, regVehicleType, owner, unit, user.residentId]);

    const handleFileInSlot = (id: string, file: File | null) => {
        setSlots(prev => prev.map(s => s.id === id ? { ...s, file } : s));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !content.trim()) {
            showToast('Vui lòng nhập đầy đủ chủ đề và nội dung.', 'error');
            return;
        }

        // Validate required slots if vehicle reg
        if (category === 'vehicle_reg') {
            const missing = slots.filter(s => !s.file);
            if (missing.length > 0) {
                showToast(`Vui lòng tải lên: ${missing.map(m => m.label).join(', ')}`, 'warn');
                return;
            }
        }

        const newFeedback: FeedbackItem = {
            id: `fb_${Date.now()}`,
            residentId: user.residentId!,
            subject,
            category,
            content,
            status: 'Pending',
            date: new Date().toISOString(),
            replies: [],
        };

        onSubmitFeedback(newFeedback);
        showToast('Gửi yêu cầu thành công! Ban Quản lý sẽ xem xét và phản hồi sớm.', 'success');
        
        // Reset Form
        setSubject('');
        setContent('');
        setCategory('general');
        setSlots([]);
    };
    
    const inputStyle = "w-full p-3 border rounded-xl bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm";
    const labelStyle = "font-black text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 ml-1 block";

  return (
    <div className="p-4 space-y-6 pb-24">
        {/* Hotline Section */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-black text-gray-800 text-sm uppercase tracking-tight mb-4 flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5 text-blue-500" />
                Liên hệ khẩn cấp
            </h2>
            <a href={`tel:${hotline}`} className="w-full flex items-center justify-center gap-4 p-4 bg-red-600 text-white font-black rounded-xl text-lg shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all">
                <PhoneArrowUpRightIcon className="w-6 h-6 animate-pulse" />
                GỌI HOTLINE BQL
            </a>
            <p className="text-[11px] font-bold text-center text-gray-400 mt-3 tracking-widest">({hotline})</p>
        </div>
        
        {/* Feedback Form Section */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-black text-gray-800 text-sm uppercase tracking-tight mb-5 flex items-center gap-2">
                <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-primary" />
                Gửi phản hồi / Báo sự cố
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className={labelStyle}>Phân loại yêu cầu</label>
                    <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value as any)} 
                        className={`${inputStyle} font-bold text-gray-800`}
                    >
                        <option value="general">Góp ý chung</option>
                        <option value="maintenance">Báo hỏng hóc, kỹ thuật</option>
                        <option value="vehicle_reg">Đăng ký gửi xe mới</option>
                        <option value="billing">Thắc mắc về hóa đơn</option>
                        <option value="other">Vấn đề khác</option>
                    </select>
                </div>

                {/* Sub-Selector for Vehicle Type */}
                {category === 'vehicle_reg' && (
                    <div className="animate-fade-in-down p-1 bg-gray-100 rounded-xl flex gap-1">
                        <button 
                            type="button"
                            onClick={() => setRegVehicleType('bike')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${regVehicleType === 'bike' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            <MotorbikeIcon className="w-4 h-4" /> XE MÁY / ĐIỆN
                        </button>
                        <button 
                            type="button"
                            onClick={() => setRegVehicleType('car')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black transition-all ${regVehicleType === 'car' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            <CarIcon className="w-4 h-4" /> Ô TÔ (XẾP LỐT)
                        </button>
                    </div>
                )}

                 <div>
                    <label className={labelStyle}>Chủ đề</label>
                    <input 
                        value={subject} 
                        onChange={e => setSubject(e.target.value)} 
                        className={`${inputStyle} font-semibold`}
                        placeholder="VD: Hỏng đèn hành lang, Đăng ký thẻ xe..."
                        required 
                    />
                </div>

                <div>
                    <label className={labelStyle}>Nội dung chi tiết</label>
                    <textarea 
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        rows={category === 'vehicle_reg' ? 12 : 6} 
                        className={`${inputStyle} leading-relaxed font-medium`}
                        placeholder="Vui lòng mô tả chi tiết yêu cầu của bạn..."
                        required 
                    />
                    {category === 'vehicle_reg' && (
                        <p className="text-[10px] text-blue-600 font-bold mt-2 italic flex items-center gap-1">
                            <InformationCircleIcon className="w-3 h-3"/> Vui lòng điền thông tin vào các dấu chấm (...) ở trên.
                        </p>
                    )}
                </div>

                {/* Specific Requirement Note only for Vehicle Registration */}
                {category === 'vehicle_reg' && (
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3 animate-fade-in-down">
                        <div className="flex items-center gap-2 text-orange-800 font-black text-[11px] uppercase tracking-wider">
                            <WarningIcon className="w-4 h-4" />
                            Hồ sơ bắt buộc cho {regVehicleType === 'car' ? 'Ô tô' : 'Xe máy'}:
                        </div>
                        <ul className="text-xs text-orange-700 space-y-2 font-medium">
                            {regVehicleType === 'bike' ? (
                                <li className="flex items-start gap-2">
                                    <span className="shrink-0 mt-1 w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                                    <span>Tải lên đủ 3 ảnh: CCCD, Đăng ký xe, Ảnh thực tế xe.</span>
                                </li>
                            ) : (
                                <li className="flex items-start gap-2">
                                    <span className="shrink-0 mt-1 w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                                    <span>Tải lên đủ 4 ảnh: Sổ đỏ/HĐMB, CCCD, Đăng ký xe, Ảnh thực tế xe.</span>
                                </li>
                            )}
                        </ul>
                    </div>
                )}

                {/* DYNAMIC UPLOAD SLOTS */}
                <div className="space-y-3">
                    <label className={labelStyle}>Hồ sơ đính kèm (Ảnh chụp)</label>
                    
                    {category === 'vehicle_reg' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-down">
                            {slots.map(slot => (
                                <div key={slot.id} className={`relative flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl transition-all ${slot.file ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                    {slot.file ? (
                                        <>
                                            <CheckCircleIcon className="w-8 h-8 text-emerald-500 mb-2" />
                                            <p className="text-[10px] font-black text-emerald-700 uppercase text-center truncate w-full px-2">{slot.file.name}</p>
                                            <button 
                                                type="button"
                                                onClick={() => handleFileInSlot(slot.id, null)}
                                                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm text-red-500 hover:text-red-700"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                                            <UploadIcon className="w-6 h-6 text-gray-400 mb-2" />
                                            <span className="text-[10px] font-black text-gray-500 uppercase text-center">{slot.label}</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={e => handleFileInSlot(slot.id, e.target.files?.[0] || null)}
                                            />
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="relative group">
                            <input 
                                type="file" 
                                multiple
                                accept="image/*" 
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[11px] file:font-black file:uppercase file:tracking-widest file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:transition-all cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    className="w-full py-4 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-focus active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <DocumentTextIcon className="w-5 h-5" />
                    Gửi yêu cầu ngay
                </button>
            </form>
        </div>
    </div>
  );
};

export default PortalContactPage;
