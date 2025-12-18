import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FeedbackItem, FeedbackReply, Role } from '../../types';
// Removed useLogger as it is not exported from App.tsx and is unused in this file
import { useNotification, useAuth } from '../../App';
import Modal from '../ui/Modal';
import { timeAgo, getPreviousPeriod } from '../../utils/helpers';
import { 
    PencilSquareIcon, CheckCircleIcon, ArrowPathIcon, 
    SearchIcon, DocumentArrowDownIcon, 
    ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon
} from '../ui/Icons';

declare const XLSX: any;

interface FeedbackManagementPageProps {
  feedback: FeedbackItem[];
  setFeedback: (updater: React.SetStateAction<FeedbackItem[]>, logPayload?: any) => void;
  role: Role;
}

const statusStyles = {
    Pending: { text: 'Chờ xử lý', classes: 'bg-yellow-100 text-yellow-800' },
    Processing: { text: 'Đang xử lý', classes: 'bg-blue-100 text-blue-800' },
    Resolved: { text: 'Đã giải quyết', classes: 'bg-green-100 text-green-800' },
};

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
        <div ref={pickerRef} className="absolute top-full mt-2 left-0 z-20 bg-white border border-gray-200 p-4 rounded-xl shadow-lg w-64">
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
                            className={`p-2 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-700'}`}
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
            /* Added optional chaining as user can be null according to AuthContextType */
            author: user?.Username || user?.Email || 'BQL',
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
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900"><strong>Chủ đề:</strong> {item.subject}</p>
                    <p className="text-gray-900 mt-2"><strong>Nội dung:</strong> {item.content}</p>
                    {item.imageUrl && (
                        <div className="mt-3">
                            <img src={item.imageUrl} alt="Attachment" className="max-h-48 rounded border border-gray-300" />
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2 border-t border-gray-200 pt-2">Gửi lúc: {new Date(item.date).toLocaleString('vi-VN')}</p>
                </div>
                
                <div>
                    <h4 className="font-semibold mb-2 text-gray-900">Lịch sử Trao đổi</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto p-2 bg-gray-100 rounded border border-gray-200 text-gray-900">
                        {item.replies.map((reply, index) => (
                            <div key={index} className="bg-white p-2 rounded shadow-sm border border-gray-100">
                                <p className="text-sm text-gray-900"><strong className="text-primary">{reply.author}:</strong> {reply.content}</p>
                                <p className="text-xs text-gray-400 mt-1">{timeAgo(reply.date)}</p>
                            </div>
                        ))}
                        {item.replies.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Chưa có trao đổi.</p>}
                    </div>
                </div>

                <div>
                    <label className="font-medium text-gray-700 text-sm">Nội dung trả lời</label>
                    <textarea 
                        value={replyContent} 
                        onChange={e => setReplyContent(e.target.value)} 
                        rows={3} 
                        className="w-full p-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:ring-primary focus:border-primary text-sm mt-1" 
                        placeholder="Nhập nội dung trả lời..."
                    />
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                        <label className="font-medium text-gray-700 text-sm">Cập nhật trạng thái:</label>
                        <select 
                            value={newStatus} 
                            onChange={handleStatusChange} 
                            className="p-2 border rounded-md bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary"
                        >
                            <option value="Pending">Chờ xử lý</option>
                            <option value="Processing">Đang xử lý</option>
                            <option value="Resolved">Đã giải quyết</option>
                        </select>
                    </div>
                    <button onClick={handleReply} className="px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-focus text-sm">Gửi & Cập nhật</button>
                </div>
            </div>
        </Modal>
    );
};


const FeedbackManagementPage: React.FC<FeedbackManagementPageProps> = ({ feedback, setFeedback, role }) => {
  const { showToast } = useNotification();
  const canManage = role === 'Admin' || role === 'Operator';
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  
  // Toolbar State
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackItem['status'] | 'all'>('all');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const handleUpdate = (updatedItem: FeedbackItem) => {
    const summary = `Cập nhật phản hồi từ ${updatedItem.residentId} sang trạng thái "${updatedItem.status}"`;
    setFeedback(
        prev => prev.map(f => f.id === updatedItem.id ? updatedItem : f),
        { module: 'Feedback', action: 'UPDATE', summary, ids: [updatedItem.id] }
    );
    showToast('Đã cập nhật phản hồi.', 'success');
  };

  const filteredFeedback = useMemo(() => {
      return feedback.filter(item => {
          // Time Filter (Month)
          const itemPeriod = item.date.substring(0, 7);
          if (itemPeriod !== period) return false;

          // Status Filter
          if (statusFilter !== 'all' && item.status !== statusFilter) return false;

          // Search Filter
          if (searchTerm) {
              const lowerSearch = searchTerm.toLowerCase();
              return (
                  item.residentId.toLowerCase().includes(lowerSearch) ||
                  item.subject.toLowerCase().includes(lowerSearch)
              );
          }
          return true;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [feedback, period, statusFilter, searchTerm]);

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
          XLSX.writeFile(workbook, `DanhSachPhanHoi_${period}.xlsx`);
          showToast('Xuất file thành công!', 'success');
      } catch (error) {
          showToast('Lỗi khi xuất file Excel.', 'error');
      }
  };

  const formatPeriodLabel = (isoPeriod: string) => {
      const [year, month] = isoPeriod.split('-');
      return `Tháng ${month}/${year}`;
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {selectedItem && <FeedbackDetailModal item={selectedItem} onUpdate={handleUpdate} onClose={() => setSelectedItem(null)} />}
      
      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left: Time & Search */}
            <div className="flex items-center gap-3 w-full md:w-auto flex-grow">
                {/* Time Picker */}
                <div className="relative flex items-center gap-1 p-1 bg-gray-100 rounded-lg flex-shrink-0">
                    <button onClick={() => setPeriod(getPreviousPeriod(period))} className="p-1 rounded hover:bg-gray-200"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <button 
                        onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} 
                        className="px-3 py-1 text-sm font-semibold hover:bg-gray-200 rounded-md w-32 text-center"
                    >
                        {formatPeriodLabel(period)}
                    </button>
                    {isMonthPickerOpen && (
                        <MonthPickerPopover currentPeriod={period} onSelectPeriod={setPeriod} onClose={() => setIsMonthPickerOpen(false)} />
                    )}
                    <button onClick={() => setPeriod(p => { const d=new Date(p+'-02'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7);})} className="p-1 rounded hover:bg-gray-200"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>

                {/* Search */}
                <div className="relative flex-grow max-w-sm">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Tìm căn hộ, chủ đề..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary"
                    />
                </div>

                {/* Filter Status */}
                <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value as any)} 
                    className="h-9 px-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary"
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Pending">Chờ xử lý</option>
                    <option value="Processing">Đang xử lý</option>
                    <option value="Resolved">Đã giải quyết</option>
                </select>
            </div>

            {/* Right: Export */}
            <div className="flex-shrink-0">
                <button 
                    onClick={handleExportExcel} 
                    className="h-9 px-4 font-semibold rounded-lg flex items-center gap-2 border border-green-600 text-green-700 hover:bg-green-50 bg-white text-sm transition-colors"
                >
                    <DocumentArrowDownIcon className="w-4 h-4"/> Export
                </button>
            </div>
        </div>
      </div>
      
      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-y-auto">
            <table className="min-w-full text-gray-900">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Căn hộ</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chủ đề</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Phân loại</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày gửi</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
                {filteredFeedback.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.residentId}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate" title={item.subject}>{item.subject}</td>
                    <td className="px-4 py-3 text-gray-600">
                        {item.category === 'maintenance' ? 'Kỹ thuật' : 
                         item.category === 'billing' ? 'Phí & HĐ' : 
                         item.category === 'general' ? 'Góp ý chung' : 'Khác'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 font-mono text-xs">{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${statusStyles[item.status].classes} bg-opacity-20 border-opacity-20`}>
                        {statusStyles[item.status].text}
                    </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                    <button 
                        onClick={() => setSelectedItem(item)} 
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors" 
                        disabled={!canManage}
                        title="Xem chi tiết & Trả lời"
                    >
                        <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
            {filteredFeedback.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <ArrowPathIcon className="w-10 h-10 mb-2 opacity-20" />
                    <p>Không tìm thấy phản hồi nào trong tháng này.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackManagementPage;
