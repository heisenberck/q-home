
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { FeedbackItem, FeedbackReply, Role, Unit, Owner } from '../../types';
import { useNotification, useAuth } from '../../App';
import Modal from '../ui/Modal';
import { timeAgo } from '../../utils/helpers';
import { 
    CheckCircleIcon, ArrowPathIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon,
    ClockIcon, ChatBubbleLeftRightIcon, WrenchIcon, BanknotesIcon, CarIcon, 
    InformationCircleIcon, ShieldCheckIcon, UserIcon, PhoneArrowUpRightIcon,
    EyeIcon, CalendarDaysIcon, ChevronDownIcon
} from '../ui/Icons';
import Spinner from '../ui/Spinner';
import { subscribeToActiveFeedback, fetchResolvedFeedback, replyFeedback } from '../../services/feedbackService';

interface FeedbackManagementPageProps {
  role: Role;
  units: Unit[];
  owners: Owner[];
}

const statusStyles = {
    Pending: { text: 'Chờ xử lý', classes: 'bg-amber-100 text-amber-800 border-amber-200', icon: <ClockIcon className="w-3.5 h-3.5" /> },
    Processing: { text: 'Đang xử lý', classes: 'bg-blue-100 text-blue-800 border-blue-200', icon: <ArrowPathIcon className="w-3.5 h-3.5" /> },
    Resolved: { text: 'Hoàn tất', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircleIcon className="w-3.5 h-3.5" /> },
};

const categoryConfig: Record<string, { label: string, icon: React.ReactNode, color: string }> = {
    maintenance: { label: 'Kỹ thuật', icon: <WrenchIcon />, color: 'bg-orange-50 text-orange-700 border-orange-100' },
    security: { label: 'An ninh', icon: <ShieldCheckIcon />, color: 'text-red-700 bg-red-50 border-red-100' },
    hygiene: { label: 'Vệ sinh', icon: <ArrowPathIcon />, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    billing: { label: 'Hóa đơn', icon: <BanknotesIcon />, color: 'text-blue-700 bg-blue-50 border-blue-100' },
    vehicle_reg: { label: 'Gửi xe', icon: <CarIcon />, color: 'text-purple-700 bg-purple-50 border-purple-100' },
    general: { label: 'Góp ý', icon: <ChatBubbleLeftRightIcon />, color: 'text-slate-700 bg-slate-100 border-slate-200' },
    other: { label: 'Khác', icon: <InformationCircleIcon />, color: 'text-gray-700 bg-gray-100 border-gray-200' },
};

// --- MonthPickerPopover Component ---
const MonthPickerPopover: React.FC<{
    currentPeriod: string;
    onSelectPeriod: (period: string) => void;
    onClose: () => void;
}> = ({ currentPeriod, onSelectPeriod, onClose }) => {
    const pickerRef = useRef<HTMLDivElement>(null);
    const [displayYear, setDisplayYear] = useState(new Date(currentPeriod + '-02').getFullYear());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div ref={pickerRef} className="absolute top-full mt-2 right-0 z-50 bg-white p-4 rounded-xl shadow-2xl border border-gray-200 w-72 animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeftIcon /></button>
                <span className="font-bold text-lg text-gray-800">{displayYear}</span>
                <button onClick={() => setDisplayYear(y => y + 1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronRightIcon /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                    const monthNum = String(index + 1).padStart(2, '0');
                    const value = `${displayYear}-${monthNum}`;
                    const isSelected = value === currentPeriod;
                    return (
                        <button
                            key={month}
                            onClick={() => { onSelectPeriod(value); onClose(); }}
                            className={`p-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const FeedbackDetailModal: React.FC<{
  item: FeedbackItem;
  resident?: Owner;
  onUpdate: (id: string, replies: FeedbackReply[], status: FeedbackItem['status'], resId: string) => Promise<void>;
  onClose: () => void;
}> = ({ item, resident, onUpdate, onClose }) => {
    const { user } = useAuth();
    const [replyContent, setReplyContent] = useState('');
    const [newStatus, setNewStatus] = useState(item.status);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAction = async () => {
        if (!replyContent.trim() && newStatus === item.status) return;
        setIsSubmitting(true);
        const updatedReplies = [...item.replies];
        if (replyContent.trim()) {
            updatedReplies.push({ author: user?.DisplayName || 'BQL', content: replyContent.trim(), date: new Date().toISOString() });
        }
        await onUpdate(item.id, updatedReplies, newStatus, item.residentId);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal title={`Chi tiết phản hồi căn ${item.residentId}`} onClose={onClose} size="4xl">
            <div className="flex flex-col md:flex-row gap-6 -m-6 bg-white">
                <div className="w-full md:w-72 bg-gray-50 border-r p-6 space-y-6">
                    <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Người gửi</h4>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserIcon className="w-6 h-6" /></div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-gray-800 truncate">{resident?.OwnerName || 'Ẩn danh'}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase">Căn {item.residentId}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t">
                        <a href={`tel:${resident?.Phone}`} className="flex items-center gap-2 text-sm font-bold text-blue-600"><PhoneArrowUpRightIcon className="w-4 h-4" /> {resident?.Phone || '---'}</a>
                        <p className="flex items-center gap-2 text-xs text-gray-500"><ClockIcon className="w-4 h-4" /> {new Date(item.date).toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="pt-4 border-t">
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Chuyển trạng thái</label>
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)} className="w-full p-2 bg-white border rounded-lg text-sm font-bold">
                            <option value="Pending">Chờ xử lý</option>
                            <option value="Processing">Đang xử lý</option>
                            <option value="Resolved">Đã hoàn tất</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    <div className="mb-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border mb-2 inline-block ${categoryConfig[item.category]?.color}`}>
                            {categoryConfig[item.category]?.label}
                        </span>
                        <h2 className="text-lg font-black text-gray-800 leading-tight">{item.subject}</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[250px] pr-2">
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                        </div>
                        {item.replies.map((r, i) => (
                            <div key={i} className={`flex ${r.author === 'BQL' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-xl border ${r.author === 'BQL' ? 'bg-primary/5 border-primary/10 rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{r.author} • {timeAgo(r.date)}</p>
                                    <p className="text-sm text-gray-800">{r.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t">
                        <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} rows={3} className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Nhập câu trả lời cho cư dân..." />
                        <div className="flex justify-end mt-3">
                            <button onClick={handleAction} disabled={isSubmitting} className="px-6 py-2 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2">
                                {isSubmitting ? <Spinner /> : <><ChatBubbleLeftRightIcon className="w-4 h-4" /> Cập nhật & Trả lời</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const FeedbackManagementPage: React.FC<FeedbackManagementPageProps> = ({ units, owners }) => {
  const { showToast } = useNotification();
  const [activeFeedback, setActiveFeedback] = useState<FeedbackItem[]>([]);
  const [resolvedFeedback, setResolvedFeedback] = useState<FeedbackItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // 1. Logic: Listen to Active Feedback (Pending/Processing)
  useEffect(() => {
      const unsub = subscribeToActiveFeedback((data) => setActiveFeedback(data));
      return () => unsub();
  }, []);

  // 2. Logic: Fetch Resolved on demand (To save Quota)
  useEffect(() => {
      if (statusFilter === 'Resolved') {
          fetchResolvedFeedback(period).then(setResolvedFeedback);
      }
  }, [statusFilter, period]);

  const displayedList = useMemo(() => {
      const base = statusFilter === 'active' ? activeFeedback : resolvedFeedback;
      return base.filter(item => {
          const q = searchTerm.toLowerCase();
          return item.residentId.includes(q) || item.subject.toLowerCase().includes(q);
      });
  }, [activeFeedback, resolvedFeedback, statusFilter, searchTerm]);

  const handleUpdate = async (id: string, replies: FeedbackReply[], status: FeedbackItem['status'], resId: string) => {
    try {
        await replyFeedback(id, replies, status, resId);
        showToast('Đã cập nhật phản hồi.', 'success');
    } catch {
        showToast('Lỗi khi cập nhật.', 'error');
    }
  };

  const formatPeriod = (p: string) => {
    const d = new Date(p + '-02');
    return `T${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {selectedItem && <FeedbackDetailModal item={selectedItem} resident={owners.find(o => o.OwnerID === units.find(u => u.UnitID === selectedItem.residentId)?.OwnerID)} onUpdate={handleUpdate} onClose={() => setSelectedItem(null)} />}

      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setStatusFilter('active')} className={`flex-1 md:w-36 py-2 rounded-lg text-xs font-black uppercase transition-all ${statusFilter === 'active' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Công việc ({(activeFeedback.length)})</button>
                <button onClick={() => setStatusFilter('Resolved')} className={`flex-1 md:w-36 py-2 rounded-lg text-xs font-black uppercase transition-all ${statusFilter === 'Resolved' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Đã xong</button>
            </div>

            <div className="relative flex-grow max-w-md w-full">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Tìm mã căn, chủ đề..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-9 pr-3 border rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary/5 bg-white border-gray-200" />
            </div>

            {statusFilter === 'Resolved' && (
                <div className="relative flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button 
                        onClick={() => setPeriod(p => { 
                            const d = new Date(p + '-02'); 
                            d.setMonth(d.getMonth() - 1); 
                            return d.toISOString().slice(0, 7); 
                        })} 
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-500"
                    >
                        <ChevronLeftIcon className="w-4 h-4"/>
                    </button>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} 
                            className="px-4 py-1.5 text-xs font-black uppercase tracking-tight text-gray-800 flex items-center gap-2 hover:bg-white rounded-lg transition-all"
                        >
                            <CalendarDaysIcon className="w-4 h-4 text-primary" />
                            {formatPeriod(period)}
                            <ChevronDownIcon className="w-3 h-3 opacity-40" />
                        </button>
                        
                        {isMonthPickerOpen && (
                            <MonthPickerPopover 
                                currentPeriod={period} 
                                onSelectPeriod={setPeriod} 
                                onClose={() => setIsMonthPickerOpen(false)} 
                            />
                        )}
                    </div>

                    <button 
                        onClick={() => setPeriod(p => { 
                            const d = new Date(p + '-02'); 
                            d.setMonth(d.getMonth() + 1); 
                            return d.toISOString().slice(0, 7); 
                        })} 
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-gray-500"
                    >
                        <ChevronRightIcon className="w-4 h-4"/>
                    </button>
                </div>
            )}
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden mb-8">
        <div className="overflow-y-auto">
            <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Căn hộ</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Phân loại</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Nội dung tóm tắt</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Trạng thái</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {displayedList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-black text-gray-900 text-sm">{item.residentId}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border flex items-center gap-1.5 w-fit ${categoryConfig[item.category]?.color || 'bg-gray-50 text-gray-500'}`}>
                                {React.cloneElement(categoryConfig[item.category]?.icon as any, { className: 'w-3 h-3' })} {categoryConfig[item.category]?.label || 'Khác'}
                            </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                            <p className="font-bold text-gray-800 text-sm truncate">{item.subject}</p>
                            <p className="text-xs text-gray-400 truncate">{item.content}</p>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex justify-center">
                                <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5 border ${statusStyles[item.status].classes}`}>
                                    {statusStyles[item.status].icon} {statusStyles[item.status].text}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => setSelectedItem(item)} className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-all" title="Xử lý">
                                <EyeIcon className="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                    ))}
                    {displayedList.length === 0 && (
                        <tr><td colSpan={5} className="py-20 text-center text-gray-400 italic">Không có dữ liệu phản hồi.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default FeedbackManagementPage;
