
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FeedbackItem, FeedbackReply, Role, Unit, Owner } from '../../types';
import { useNotification, useAuth, useDataRefresh } from '../../App';
import Modal from '../ui/Modal';
import { timeAgo, getPreviousPeriod } from '../../utils/helpers';
import { 
    PencilSquareIcon, CheckCircleIcon, ArrowPathIcon, 
    SearchIcon, ChevronLeftIcon, ChevronRightIcon,
    ClockIcon, ChatBubbleLeftRightIcon, XMarkIcon,
    WrenchIcon, BanknotesIcon, CarIcon, InformationCircleIcon,
    ShieldCheckIcon, UserIcon, PhoneArrowUpRightIcon,
    EyeIcon
} from '../ui/Icons';
import Spinner from '../ui/Spinner';
import { replyFeedback } from '../../services';

interface FeedbackManagementPageProps {
  feedback: FeedbackItem[];
  setFeedback: (updater: React.SetStateAction<FeedbackItem[]>, logPayload?: any) => void;
  role: Role;
  units: Unit[];
  owners: Owner[];
}

const statusStyles = {
    Pending: { text: 'Chờ xử lý', classes: 'bg-amber-100 text-amber-800 border-amber-200', icon: <ClockIcon className="w-4 h-4" /> },
    Processing: { text: 'Đang xử lý', classes: 'bg-blue-100 text-blue-800 border-blue-200', icon: <ArrowPathIcon className="w-4 h-4" /> },
    Resolved: { text: 'Đã giải quyết', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircleIcon className="w-4 h-4" /> },
};

const categoryConfig: Record<FeedbackItem['category'], { label: string, icon: React.ReactNode, color: string }> = {
    maintenance: { label: 'Kỹ thuật', icon: <WrenchIcon className="w-3.5 h-3.5" />, color: 'bg-orange-50 text-orange-700 border-orange-100' },
    security: { label: 'An ninh', icon: <ShieldCheckIcon className="w-3.5 h-3.5" />, color: 'text-red-700 bg-red-50 border-red-100' },
    hygiene: { label: 'Vệ sinh', icon: <ArrowPathIcon className="w-3.5 h-3.5" />, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    billing: { label: 'Hóa đơn', icon: <BanknotesIcon className="w-3.5 h-3.5" />, color: 'text-blue-700 bg-blue-50 border-blue-100' },
    vehicle_reg: { label: 'Gửi xe', icon: <CarIcon className="w-3.5 h-3.5" />, color: 'text-purple-700 bg-purple-50 border-purple-100' },
    general: { label: 'Góp ý', icon: <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />, color: 'text-slate-700 bg-slate-100 border-slate-200' },
    other: { label: 'Khác', icon: <InformationCircleIcon className="w-3.5 h-3.5" />, color: 'text-gray-700 bg-gray-100 border-gray-200' },
};

const CompactStatCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, value, icon, colorClass, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white rounded-xl shadow-sm p-4 border transition-all cursor-pointer hover:shadow-md active:scale-95 ${
            isActive ? `ring-2 ring-primary border-primary bg-primary/5` : 'border-gray-100'
        }`}
    >
        <div className="flex items-center justify-between">
            <div>
                <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                    {label}
                </p>
                <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
            </div>
            <div className={`p-2.5 rounded-xl ${colorClass} shadow-sm transition-transform ${isActive ? 'scale-110' : ''}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
            </div>
        </div>
    </div>
);

const FeedbackDetailModal: React.FC<{
  item: FeedbackItem;
  resident?: Owner;
  onUpdate: (id: string, replies: FeedbackReply[], status: FeedbackItem['status'], residentId: string) => Promise<void>;
  onClose: () => void;
}> = ({ item, resident, onUpdate, onClose }) => {
    const { user } = useAuth();
    const [replyContent, setReplyContent] = useState('');
    const [newStatus, setNewStatus] = useState(item.status);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReply = async () => {
        if (!replyContent.trim() && newStatus === item.status) return;
        
        setIsSubmitting(true);
        const updatedReplies = [...item.replies];
        if (replyContent.trim()) {
            updatedReplies.push({
                author: user?.DisplayName || user?.Username || 'BQL',
                content: replyContent.trim(),
                date: new Date().toISOString(),
            });
        }
        
        await onUpdate(item.id, updatedReplies, newStatus, item.residentId);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal title={`Phản hồi #${item.id.slice(-4).toUpperCase()}`} onClose={onClose} size="4xl">
            <div className="flex flex-col md:flex-row gap-6 -m-6 bg-white min-h-[500px]">
                {/* Left Side: Resident Info */}
                <div className="w-full md:w-72 bg-gray-50 border-r border-gray-100 p-6 space-y-6 shrink-0">
                    <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Người gửi</h4>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <UserIcon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-gray-800 truncate">{resident?.OwnerName || 'Ẩn danh'}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-tight">Căn {item.residentId}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-3">
                            <PhoneArrowUpRightIcon className="w-4 h-4 text-gray-400" />
                            <a href={`tel:${resident?.Phone}`} className="text-sm font-bold text-blue-600 hover:underline">{resident?.Phone || '---'}</a>
                        </div>
                        <div className="flex items-center gap-3">
                            <ClockIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-600">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>

                    <div className="pt-6">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Trạng thái xử lý</label>
                        <select 
                            value={newStatus} 
                            onChange={e => setNewStatus(e.target.value as any)} 
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="Pending">Chờ xử lý</option>
                            <option value="Processing">Đang xử lý</option>
                            <option value="Resolved">Đã giải quyết</option>
                        </select>
                    </div>
                </div>

                {/* Main Content: Conversation */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden bg-white">
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${categoryConfig[item.category].color}`}>
                                {categoryConfig[item.category].label}
                            </span>
                            {item.priority === 'high' && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">Khẩn cấp</span>
                            )}
                        </div>
                        <h2 className="text-lg font-black text-gray-800 leading-tight">{item.subject}</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 min-h-[200px]">
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                            {item.imageUrl && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 aspect-video max-w-sm">
                                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="Feedback" />
                                </div>
                            )}
                        </div>

                        {item.replies.map((reply, idx) => (
                            <div key={idx} className={`flex ${reply.author === 'BQL' || reply.author === user?.DisplayName ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm border ${
                                    reply.author === 'BQL' || reply.author === user?.DisplayName
                                        ? 'bg-primary/5 border-primary/10 rounded-tr-none'
                                        : 'bg-white border-gray-100 rounded-tl-none'
                                }`}>
                                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1 flex justify-between gap-4">
                                        <span>{reply.author}</span>
                                        <span className="font-bold opacity-60">{timeAgo(reply.date)}</span>
                                    </p>
                                    <p className="text-sm text-gray-800 leading-snug">{reply.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <textarea 
                            value={replyContent} 
                            onChange={e => setReplyContent(e.target.value)} 
                            rows={3} 
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                            placeholder="Nhập nội dung phản hồi tới cư dân..."
                        />
                        <div className="flex justify-end mt-3">
                            <button 
                                onClick={handleReply} 
                                disabled={isSubmitting} 
                                className="px-6 py-2.5 bg-primary text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-primary-focus active:scale-[0.98] transition-all text-xs flex items-center gap-2"
                            >
                                {isSubmitting ? <Spinner /> : <><ChatBubbleLeftRightIcon className="w-4 h-4" /> Gửi & Cập nhật</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const FeedbackManagementPage: React.FC<FeedbackManagementPageProps> = ({ feedback, setFeedback, role, units, owners }) => {
  const { showToast } = useNotification();
  const { refreshData } = useDataRefresh();
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackItem['status'] | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleUpdateFeedback = async (id: string, replies: FeedbackReply[], status: FeedbackItem['status'], residentId: string) => {
    try {
        await replyFeedback(id, replies, status, residentId);
        showToast('Đã cập nhật phản hồi.', 'success');
        refreshData(true);
    } catch (error) {
        showToast('Lỗi khi cập nhật phản hồi.', 'error');
    }
  };

  const stats = useMemo(() => ({
      total: feedback.length,
      pending: feedback.filter(f => f.status === 'Pending').length,
      processing: feedback.filter(f => f.status === 'Processing').length,
      resolved: feedback.filter(f => f.status === 'Resolved').length
  }), [feedback]);

  const filteredFeedback = useMemo(() => {
      return feedback.filter(item => {
          if (statusFilter !== 'all' && item.status !== statusFilter) return false;
          if (searchTerm) {
              const q = searchTerm.toLowerCase();
              return item.residentId.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q);
          }
          return true;
      }).sort((a, b) => {
          if (a.status === 'Pending' && b.status !== 'Pending') return -1;
          if (b.status === 'Pending' && a.status !== 'Pending') return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [feedback, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredFeedback.length / ITEMS_PER_PAGE);
  const paginatedFeedback = useMemo(() => filteredFeedback.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredFeedback, currentPage]);

  const getResidentOwner = (unitId: string) => {
      const unit = units.find(u => u.UnitID === unitId);
      return owners.find(o => o.OwnerID === unit?.OwnerID);
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {selectedItem && (
          <FeedbackDetailModal 
            item={selectedItem} 
            resident={getResidentOwner(selectedItem.residentId)}
            onUpdate={handleUpdateFeedback} 
            onClose={() => setSelectedItem(null)} 
          />
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactStatCard label="Tất cả" value={stats.total} icon={<ChatBubbleLeftRightIcon />} colorClass="bg-slate-100 text-slate-600" isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <CompactStatCard label="Chờ xử lý" value={stats.pending} icon={<ClockIcon />} colorClass="bg-amber-100 text-amber-600" isActive={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} />
          <CompactStatCard label="Đang xử lý" value={stats.processing} icon={<ArrowPathIcon />} colorClass="bg-blue-100 text-blue-600" isActive={statusFilter === 'Processing'} onClick={() => setStatusFilter('Processing')} />
          <CompactStatCard label="Hoàn tất" value={stats.resolved} icon={<CheckCircleIcon />} colorClass="bg-emerald-100 text-emerald-600" isActive={statusFilter === 'Resolved'} onClick={() => setStatusFilter('Resolved')} />
      </div>

      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-grow max-w-md w-full">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Tìm mã căn, chủ đề..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all bg-white"
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Trạng thái:</span>
                <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as any)} 
                    className="h-10 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-primary/20 outline-none"
                >
                    <option value="all">Tất cả</option>
                    <option value="Pending">🟡 Chờ xử lý</option>
                    <option value="Processing">🔵 Đang xử lý</option>
                    <option value="Resolved">🟢 Hoàn tất</option>
                </select>
            </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden mb-8">
        <div className="overflow-y-auto">
            <table className="min-w-full">
                <thead className="bg-gray-50/50 sticky top-0 z-10 border-b border-gray-100">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Căn hộ</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Phân loại</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Nội dung phản hồi</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Ngày gửi</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Trạng thái</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {paginatedFeedback.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 font-black text-gray-900 text-sm">{item.residentId}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border flex items-center gap-1.5 w-fit ${categoryConfig[item.category].color}`}>
                                {categoryConfig[item.category].icon} {categoryConfig[item.category].label}
                            </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                            <p className="font-bold text-gray-800 text-sm line-clamp-1">{item.subject}</p>
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.content}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="text-gray-500 text-[10px] font-bold">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                                <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-sm border ${statusStyles[item.status].classes}`}>
                                    {statusStyles[item.status].icon} {statusStyles[item.status].text}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                                <button 
                                    onClick={() => setSelectedItem(item)} 
                                    className="p-2 hover:bg-primary/10 text-gray-400 hover:text-primary rounded-xl transition-all"
                                    title="Xem & Trả lời"
                                >
                                    <EyeIcon className="w-5 h-5" />
                                </button>
                                {item.status !== 'Resolved' && (
                                    <button 
                                        onClick={() => handleUpdateFeedback(item.id, item.replies, 'Resolved', item.residentId)}
                                        className="p-2 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-xl transition-all"
                                        title="Đóng phản hồi"
                                    >
                                        <CheckCircleIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
            </table>
            {paginatedFeedback.length === 0 && (
                <div className="py-20 text-center text-gray-400 italic">Không tìm thấy phản hồi phù hợp.</div>
            )}
        </div>
      </div>

      <div className="fixed bottom-0 right-0 z-50 h-7 flex items-center gap-4 px-6 bg-white border-t border-l border-gray-200">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trang {currentPage} / {totalPages || 1}</span>
          <div className="flex gap-1 items-center">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 hover:bg-gray-100 disabled:opacity-30"><ChevronLeftIcon className="w-4 h-4" /></button>
              <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-1 hover:bg-gray-100 disabled:opacity-30"><ChevronRightIcon className="w-4 h-4" /></button>
          </div>
      </div>
    </div>
  );
};

export default FeedbackManagementPage;
