
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FeedbackItem, FeedbackReply, Role } from '../../types';
import { useNotification, useAuth } from '../../App';
import Modal from '../ui/Modal';
import { timeAgo, getPreviousPeriod } from '../../utils/helpers';
import { 
    PencilSquareIcon, CheckCircleIcon, ArrowPathIcon, 
    SearchIcon, DocumentArrowDownIcon, 
    ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon,
    ClockIcon, ChatBubbleLeftRightIcon, StarIcon
} from '../ui/Icons';
import Spinner from '../ui/Spinner';

declare const XLSX: any;

interface FeedbackManagementPageProps {
  feedback: FeedbackItem[];
  setFeedback: (updater: React.SetStateAction<FeedbackItem[]>, logPayload?: any) => void;
  role: Role;
}

const statusStyles = {
    Pending: { text: 'Chờ xử lý', classes: 'bg-yellow-100 text-yellow-800', icon: <ClockIcon className="w-4 h-4" /> },
    Processing: { text: 'Đang xử lý', classes: 'bg-blue-100 text-blue-800', icon: <ArrowPathIcon className="w-4 h-4" /> },
    Resolved: { text: 'Đã giải quyết', classes: 'bg-green-100 text-green-800', icon: <CheckCircleIcon className="w-4 h-4" /> },
};

const CompactStatCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    borderColorClass: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, value, icon, colorClass, borderColorClass, isActive, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${borderColorClass} flex items-center justify-between transition-all cursor-pointer hover:shadow-md active:scale-95 ${
            isActive ? 'ring-2 ring-primary ring-offset-2 shadow-md' : 'opacity-80'
        }`}
    >
        <div>
            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                {label}
            </p>
            <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${colorClass} shadow-sm ${isActive ? 'scale-110' : ''} transition-transform`}>
            {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
        </div>
    </div>
);

// --- Child Component: Month Picker (Local) ---
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
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-50 bg-white border border-gray-200 p-4 rounded-xl shadow-2xl w-64 animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setDisplayYear(y => y - 1)} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeftIcon /></button>
                <span className="font-bold text-gray-800">{displayYear}</span>
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
                            className={`p-2 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- Child Component: Detail Modal ---
const FeedbackDetailModal: React.FC<{
  item: FeedbackItem;
  onUpdate: (updatedItem: FeedbackItem) => void;
  onClose: () => void;
}> = ({ item, onUpdate, onClose }) => {
    const { user } = useAuth();
    const [replyContent, setReplyContent] = useState('');
    const [newStatus, setNewStatus] = useState(item.status);

    const handleReply = () => {
        if (!replyContent.trim()) return;
        const newReply: FeedbackReply = {
            author: user?.DisplayName || user?.Username || user?.Email || 'BQL',
            content: replyContent.trim(),
            date: new Date().toISOString(),
        };
        onUpdate({ ...item, replies: [...item.replies, newReply], status: newStatus });
        setReplyContent('');
    };
    
    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const status = e.target.value as FeedbackItem['status'];
        setNewStatus(status);
        onUpdate({ ...item, status });
    };

    return (
        <Modal title={`Phản hồi từ Cư dân ${item.residentId}`} onClose={onClose} size="2xl">
            <div className="space-y-4 text-gray-900 bg-white">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                         <p className="text-gray-900 font-bold text-lg">{item.subject}</p>
                         <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-full border ${statusStyles[item.status].classes}`}>
                            {statusStyles[item.status].text}
                        </span>
                    </div>
                    <p className="text-gray-700 mt-2 leading-relaxed">{item.content}</p>
                    {item.imageUrl && (
                        <div className="mt-4">
                            <img src={item.imageUrl} alt="Attachment" className="max-h-64 rounded-xl border border-gray-300 shadow-sm" />
                        </div>
                    )}
                    <p className="text-[10px] font-bold text-gray-400 mt-4 border-t border-gray-200 pt-3 uppercase tracking-wider">Gửi lúc: {new Date(item.date).toLocaleString('vi-VN')}</p>
                </div>
                
                <div>
                    <h4 className="font-black text-[11px] text-gray-400 uppercase tracking-widest mb-3">Lịch sử Trao đổi</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-900 shadow-inner">
                        {item.replies.map((reply, index) => (
                            <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 animate-fade-in-down">
                                <div className="flex justify-between items-center mb-1">
                                    <strong className="text-primary text-xs font-black uppercase tracking-tight">{reply.author}</strong>
                                    <span className="text-[10px] text-gray-400 font-bold">{timeAgo(reply.date)}</span>
                                </div>
                                <p className="text-sm text-gray-700 leading-snug">{reply.content}</p>
                            </div>
                        ))}
                        {item.replies.length === 0 && <p className="text-sm text-gray-400 text-center py-6 italic">Chưa có trao đổi nào.</p>}
                    </div>
                </div>

                <div className="pt-2">
                    <label className="font-black text-[11px] text-gray-400 uppercase tracking-widest mb-2 block">Nội dung trả lời</label>
                    <textarea 
                        value={replyContent} 
                        onChange={e => setReplyContent(e.target.value)} 
                        rows={3} 
                        className="w-full p-3 border rounded-xl bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all shadow-sm" 
                        placeholder="Nhập nội dung phản hồi tới cư dân..."
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label className="font-bold text-xs text-gray-600 whitespace-nowrap">Trạng thái:</label>
                        <select 
                            value={newStatus} 
                            onChange={handleStatusChange} 
                            className="flex-1 sm:flex-none p-2 border rounded-lg bg-white border-gray-300 text-gray-900 text-xs font-bold focus:ring-primary focus:border-primary"
                        >
                            <option value="Pending">Chờ xử lý</option>
                            <option value="Processing">Đang xử lý</option>
                            <option value="Resolved">Đã giải quyết</option>
                        </select>
                    </div>
                    <button onClick={handleReply} className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-focus active:scale-95 transition-all text-xs">
                        Gửi & Cập nhật
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const FeedbackManagementPage: React.FC<FeedbackManagementPageProps> = ({ feedback, setFeedback, role }) => {
  const { showToast } = useNotification();
  const canManage = role === 'Admin' || role === 'Operator';
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Toolbar State
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackItem['status'] | 'all'>('all');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleUpdate = (updatedItem: FeedbackItem) => {
    const summary = `Cập nhật phản hồi từ ${updatedItem.residentId} sang trạng thái "${updatedItem.status}"`;
    setFeedback(
        prev => prev.map(f => f.id === updatedItem.id ? updatedItem : f),
        { module: 'Feedback', action: 'UPDATE', summary, ids: [updatedItem.id] }
    );
    showToast('Đã cập nhật phản hồi.', 'success');
  };

  // Lấy danh sách phản hồi cho tháng hiện tại (Chưa lọc theo Status)
  const currentMonthFeedback = useMemo(() => {
    return feedback.filter(item => item.date.substring(0, 7) === period);
  }, [feedback, period]);

  // Thống kê cho tháng đang chọn (Big Picture - Luôn đúng bất kể bộ lọc Status)
  const stats = useMemo(() => {
      return {
          total: currentMonthFeedback.length,
          pending: currentMonthFeedback.filter(f => f.status === 'Pending').length,
          processing: currentMonthFeedback.filter(f => f.status === 'Processing').length,
          resolved: currentMonthFeedback.filter(f => f.status === 'Resolved').length
      };
  }, [currentMonthFeedback]);

  // Danh sách hiển thị thực tế sau khi lọc Status & Search
  const filteredFeedback = useMemo(() => {
      return currentMonthFeedback.filter(item => {
          if (statusFilter !== 'all' && item.status !== statusFilter) return false;
          if (searchTerm) {
              const lowerSearch = searchTerm.toLowerCase();
              return (
                  item.residentId.toLowerCase().includes(lowerSearch) ||
                  item.subject.toLowerCase().includes(lowerSearch) ||
                  item.content.toLowerCase().includes(lowerSearch)
              );
          }
          return true;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentMonthFeedback, statusFilter, searchTerm]);

  // Logic phân trang
  const totalPages = Math.ceil(filteredFeedback.length / ITEMS_PER_PAGE);
  const paginatedFeedback = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredFeedback.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredFeedback, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, period]);

  const handleExportExcel = () => {
      if (filteredFeedback.length === 0) {
          showToast('Không có dữ liệu để xuất.', 'info');
          return;
      }
      try {
          const dataToExport = filteredFeedback.map((item, index) => ({
              STT: index + 1,
              'Căn hộ': item.residentId,
              'Chủ đề': item.subject,
              'Phân loại': item.category,
              'Nội dung': item.content,
              'Ngày gửi': new Date(item.date).toLocaleDateString('vi-VN'),
              'Trạng thái': statusStyles[item.status]?.text || item.status,
              'Số lượng phản hồi': item.replies.length
          }));

          const worksheet = XLSX.utils.json_to_sheet(dataToExport);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Feedback");
          XLSX.writeFile(workbook, `Bao_cao_Phan_hoi_${period}.xlsx`);
          showToast('Xuất báo cáo Excel thành công!', 'success');
      } catch (error) {
          showToast('Lỗi khi xuất file Excel.', 'error');
      }
  };

  const formatPeriodLabel = (isoPeriod: string) => {
      const [year, month] = isoPeriod.split('-');
      return `Tháng ${month}/${year}`;
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {selectedItem && <FeedbackDetailModal item={selectedItem} onUpdate={handleUpdate} onClose={() => setSelectedItem(null)} />}
      
      {/* 1. STAT CARDS (Now with Filter Action) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactStatCard 
              label="Tổng nhận" 
              value={stats.total} 
              icon={<ChatBubbleLeftRightIcon />} 
              colorClass="bg-gray-100 text-gray-600" 
              borderColorClass="border-gray-400" 
              isActive={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
          />
          <CompactStatCard 
              label="Chờ xử lý" 
              value={stats.pending} 
              icon={<ClockIcon />} 
              colorClass="bg-yellow-100 text-yellow-600" 
              borderColorClass="border-yellow-500" 
              isActive={statusFilter === 'Pending'}
              onClick={() => setStatusFilter('Pending')}
          />
          <CompactStatCard 
              label="Đang xử lý" 
              value={stats.processing} 
              icon={<ArrowPathIcon />} 
              colorClass="bg-blue-100 text-blue-600" 
              borderColorClass="border-blue-500" 
              isActive={statusFilter === 'Processing'}
              onClick={() => setStatusFilter('Processing')}
          />
          <CompactStatCard 
              label="Hoàn tất" 
              value={stats.resolved} 
              icon={<CheckCircleIcon />} 
              colorClass="bg-green-100 text-green-600" 
              borderColorClass="border-green-500" 
              isActive={statusFilter === 'Resolved'}
              onClick={() => setStatusFilter('Resolved')}
          />
      </div>

      {/* 2. TOOLBAR */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Time & Search */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 shadow-inner">
                    <button onClick={() => setPeriod(getPreviousPeriod(period))} className="p-1.5 rounded-lg hover:bg-white text-gray-500 transition-all"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <button 
                        onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} 
                        className="px-3 py-1.5 text-xs font-black uppercase tracking-tight hover:bg-white hover:text-primary rounded-lg w-32 text-center transition-all"
                    >
                        {formatPeriodLabel(period)}
                    </button>
                    {isMonthPickerOpen && (
                        <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />
                    )}
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7);})} className="p-1.5 rounded-lg hover:bg-white text-gray-500 transition-all"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>

                <div className="relative flex-grow max-w-sm">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Tìm mã căn, nội dung..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 border rounded-xl bg-white border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                </div>

                <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as any)} 
                    className="h-10 px-3 border rounded-xl bg-white border-gray-200 text-gray-800 text-xs font-bold focus:ring-primary focus:border-primary outline-none shadow-sm"
                >
                    <option value="all">TẤT CẢ TRẠNG THÁI</option>
                    <option value="Pending">CHỜ XỬ LÝ</option>
                    <option value="Processing">ĐANG XỬ LÝ</option>
                    <option value="Resolved">ĐÃ GIẢI QUYẾT</option>
                </select>
            </div>

            <button 
                onClick={handleExportExcel} 
                className="h-10 px-4 font-black uppercase tracking-widest rounded-xl flex items-center gap-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-[10px] transition-all shadow-sm active:scale-95"
            >
                <DocumentArrowDownIcon className="w-4 h-4 opacity-70"/> Xuất báo cáo
            </button>
      </div>
      
      {/* 3. LIST/TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden mb-8">
        <div className="overflow-y-auto">
            <table className="min-w-full text-gray-900">
                <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Căn hộ</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Chủ đề & Nội dung</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Phân loại</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ngày gửi</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Trạng thái</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white text-sm">
                    {paginatedFeedback.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-black text-gray-900 text-base">{item.residentId}</td>
                        <td className="px-6 py-4 max-w-md">
                            <p className="font-bold text-gray-800 line-clamp-1">{item.subject}</p>
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.content}</p>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border border-gray-100 bg-gray-50 text-gray-500">
                                {item.category === 'maintenance' ? 'Kỹ thuật' : 
                                item.category === 'billing' ? 'Tài chính' : 
                                item.category === 'general' ? 'Góp ý' : 'Khác'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-400 font-mono text-[10px]">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                                <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-sm ring-1 ring-inset border-none ${statusStyles[item.status].classes} ring-current/20`}>
                                    {statusStyles[item.status].icon}
                                    {statusStyles[item.status].text}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <button 
                                onClick={() => setSelectedItem(item)} 
                                className="p-2.5 hover:bg-primary/10 text-gray-300 hover:text-primary rounded-xl transition-all active:scale-90" 
                                disabled={!canManage}
                                title="Xem chi tiết & Trả lời"
                            >
                                <PencilSquareIcon className="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                    ))}
                </tbody>
            </table>
            {filteredFeedback.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                    <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-[11px]">Không tìm thấy phản hồi phù hợp</p>
                </div>
            )}
        </div>
      </div>

      {/* 4. FLOATING PAGINATION FOOTER OVERLAY */}
      <div className="fixed bottom-0 right-0 z-50 h-7 flex items-center gap-4 px-6 bg-white border-t border-l border-gray-200 shadow-none">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Trang {currentPage} / {totalPages || 1}
          </span>
          
          <div className="flex gap-1 h-full items-center">
              <button 
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 transition-all text-gray-500"
              >
                  <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button 
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-30 transition-all text-gray-500"
              >
                  <ChevronRightIcon className="w-4 h-4" />
              </button>
          </div>
      </div>
    </div>
  );
};

export default FeedbackManagementPage;
