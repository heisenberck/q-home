
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { NewsItem, Role } from '../../types';
import { useNotification, useLogger } from '../../App';
import Modal from '../ui/Modal';
import { 
    PencilSquareIcon, TrashIcon, UploadIcon, MegaphoneIcon, ArchiveBoxIcon, 
    CheckCircleIcon, ListBulletIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon 
} from '../ui/Icons';
import { timeAgo } from '../../utils/helpers';

interface NewsManagementPageProps {
  news: NewsItem[];
  setNews: (updater: React.SetStateAction<NewsItem[]>, logPayload?: any) => void;
  role: Role;
}

const NewsEditorModal: React.FC<{
  newsItem?: NewsItem | null;
  onSave: (item: NewsItem) => void;
  onClose: () => void;
}> = ({ newsItem, onSave, onClose }) => {
  const { showToast } = useNotification();
  
  // State initialization
  const [item, setItem] = useState<Omit<NewsItem, 'id' | 'date'>>(
    newsItem 
      ? { title: newsItem.title, content: newsItem.content || '', priority: newsItem.priority, category: newsItem.category, imageUrl: newsItem.imageUrl, sender: newsItem.sender || 'BQLVH' } 
      : { title: '', content: '', priority: 'normal', category: 'notification', imageUrl: '', sender: 'BQLVH' }
  );
  const [imagePreview, setImagePreview] = useState(newsItem?.imageUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // FIX: Initialize content editor only once on mount to prevent React re-render conflicts
  useEffect(() => {
      if (editorRef.current) {
          editorRef.current.innerHTML = item.content || '';
      }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setItem({ ...item, [e.target.name]: e.target.value });
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                showToast('Không thể xử lý ảnh.', 'error');
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setImagePreview(dataUrl);
            setItem(prev => ({ ...prev, imageUrl: dataUrl }));
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalItem: NewsItem = {
      ...item,
      // Ensure we grab the latest content from the DOM if available, otherwise use state
      content: editorRef.current ? editorRef.current.innerHTML : item.content,
      imageUrl: imagePreview,
      id: newsItem?.id || `news_${Date.now()}`,
      date: newsItem?.date || new Date().toISOString(),
      isArchived: newsItem?.isArchived || false,
      isBroadcasted: newsItem?.isBroadcasted || false,
    };
    onSave(finalItem);
  };

  const handleFormat = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value ?? undefined);
    if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setItem(prev => ({ ...prev, content: newContent }));
        editorRef.current.focus(); // Keep focus
    }
  };
  
  // Strict Light Mode Styles
  const inputStyle = "w-full h-10 px-3 border rounded-md bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-sm placeholder-gray-400";
  const labelStyle = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title={newsItem ? "Sửa Tin tức" : "Tạo Tin tức mới"} onClose={onClose} size="3xl">
      <form onSubmit={handleSubmit} className="space-y-5 bg-white text-gray-900 p-1">
        
        {/* Row 1: Title */}
        <div>
            <label className={labelStyle}>Tiêu đề tin</label>
            <input name="title" value={item.title} onChange={handleChange} className={inputStyle} placeholder="Nhập tiêu đề..." required />
        </div>

        {/* Row 2: Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div>
                <label className={labelStyle}>Phân loại</label>
                <select name="category" value={item.category} onChange={handleChange} className={inputStyle}>
                    <option value="notification">Thông báo</option>
                    <option value="plan">Kế hoạch</option>
                    <option value="event">Sự kiện</option>
                </select>
            </div>
            <div>
                <label className={labelStyle}>Ưu tiên</label> 
                <select name="priority" value={item.priority} onChange={handleChange} className={inputStyle}>
                    <option value="normal">Thông thường</option>
                    <option value="high">Quan trọng</option>
                </select>
            </div>
        </div>

        {/* Row 3: Image */}
        <div>
          <label className={labelStyle}>Ảnh đại diện</label>
          <div className="mt-1 flex items-start gap-4">
            <div className="w-40 h-24 bg-gray-100 border border-gray-300 rounded-md overflow-hidden flex-shrink-0 relative group">
                {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Không có ảnh</div>
                )}
            </div>
            <div className="flex-grow pt-1">
                 <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                 <div className="flex gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md shadow-sm text-sm hover:bg-gray-50 transition-colors">
                        <UploadIcon className="w-4 h-4" /> Tải ảnh
                    </button>
                    {imagePreview && (
                        <button type="button" onClick={() => {setImagePreview(''); setItem(p=>({...p, imageUrl:''}))}} className="px-3 py-1.5 text-red-600 hover:text-red-800 text-sm font-medium">
                            Xóa ảnh
                        </button>
                    )}
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Định dạng hỗ trợ: JPG, PNG. Dung lượng tối ưu &lt; 2MB.</p>
            </div>
          </div>
        </div>

        {/* Row 4: Editor (FIXED) */}
        <div>
          <label className={labelStyle}>Nội dung chi tiết</label>
            <div className="border border-gray-300 rounded-md mt-1 bg-white overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 select-none">
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-800 font-bold min-w-[32px] text-center" title="Bold">B</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-800 italic min-w-[32px] text-center" title="Italic">I</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-800 underline min-w-[32px] text-center" title="Underline">U</button>
                    <div className="w-px h-5 bg-gray-300 mx-2"></div>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-800 flex items-center justify-center min-w-[32px]" title="List"><ListBulletIcon className="w-5 h-5"/></button>
                </div>
                
                {/* Editable Area - NO dangerouslySetInnerHTML */}
                <div 
                    ref={editorRef}
                    className="w-full p-4 min-h-[250px] max-h-[500px] overflow-y-auto bg-white text-gray-900 outline-none cursor-text text-sm leading-relaxed"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onInput={(e) => {
                        // Store HTML in state without forcing DOM refresh via React render
                        const newContent = e.currentTarget.innerHTML;
                        setItem(prev => ({ ...prev, content: newContent }));
                    }}
                />
            </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-2">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Người gửi:</label>
                <select name="sender" value={item.sender} onChange={handleChange} className="h-9 px-2 border rounded-md bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary">
                    <option value="BQLVH">Ban Quản lý (BQLVH)</option>
                    <option value="BQT">Ban Quản trị (BQT)</option>
                </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors">Hủy</button>
              <button type="submit" className="px-6 py-2 bg-primary text-white font-bold rounded-md shadow-sm hover:bg-primary-focus transition-colors">Lưu tin</button>
            </div>
        </div>
      </form>
    </Modal>
  );
};

const NewsManagementPage: React.FC<NewsManagementPageProps> = ({ news, setNews, role }) => {
  const { showToast } = useNotification();
  const { logAction } = useLogger();
  const canManage = role === 'Admin';

  const [editingItem, setEditingItem] = useState<NewsItem | null | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<NewsItem['category'] | 'all'>('all');
  const [senderFilter, setSenderFilter] = useState<'BQT' | 'BQLVH' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const filteredNews = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    return news
        .filter(item => {
            if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
            if (senderFilter !== 'all' && item.sender !== senderFilter) return false;
            if (timeFilter !== 'all') {
                const itemDate = new Date(item.date);
                if (timeFilter === 'this_month') {
                    if (itemDate.getMonth() !== thisMonth || itemDate.getFullYear() !== thisYear) return false;
                } else if (timeFilter === 'last_month') {
                     if (itemDate.getMonth() !== lastMonth || itemDate.getFullYear() !== lastMonthYear) return false;
                }
            }
            return true;
        })
        .sort((a,b) => {
            if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
  }, [news, searchTerm, categoryFilter, senderFilter, timeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, senderFilter, timeFilter]);

  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNews.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNews, currentPage]);

  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);

  const handleSave = (item: NewsItem) => {
    const isNew = !news.some(n => n.id === item.id);
    const summary = isNew ? `Tạo tin tức mới: "${item.title}"` : `Cập nhật tin tức: "${item.title}"`;

    const updater = (prev: NewsItem[]) => isNew ? [item, ...prev] : prev.map(n => n.id === item.id ? item : n);
    setNews(updater, { module: 'News', action: isNew ? 'CREATE' : 'UPDATE', summary, ids: [item.id], before_snapshot: news });
    
    showToast(isNew ? 'Đã đăng tin tức mới.' : 'Đã cập nhật tin tức.', 'success');
    setEditingItem(undefined);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tin tức này?')) {
      const itemToDelete = news.find(n => n.id === id);
      setNews(prev => prev.filter(n => n.id !== id), { module: 'News', action: 'DELETE', summary: `Xóa tin tức: "${itemToDelete?.title}"`, ids: [id], before_snapshot: news });
      showToast('Đã xóa tin tức.', 'success');
    }
  };
  
  const handleBroadcast = (id: string) => {
    const itemToBroadcast = news.find(n => n.id === id);
    if (!itemToBroadcast || itemToBroadcast.isBroadcasted) return;

    if (window.confirm(`Gửi thông báo đẩy cho tin: "${itemToBroadcast.title}"?`)) {
        const summary = `Gửi thông báo tin tức: "${itemToBroadcast?.title}"`;
        setNews(
            prev => prev.map(n => n.id === id ? { ...n, isBroadcasted: true, broadcastTime: new Date().toISOString() } : n),
            { module: 'News', action: 'BROADCAST', summary, ids: [id], before_snapshot: news }
        );
        showToast('Đã gửi thông báo.', 'success');
    }
  };

  const handleArchive = (id: string) => {
      const itemToArchive = news.find(n => n.id === id);
      if (!itemToArchive) return;
      const summary = `Lưu trữ tin tức: "${itemToArchive?.title}"`;
      setNews(
          prev => prev.map(n => n.id === id ? { ...n, isArchived: true } : n),
          { module: 'News', action: 'ARCHIVE', summary, ids: [id], before_snapshot: news }
      );
      showToast('Đã lưu trữ tin tức.', 'success');
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {editingItem !== undefined && <NewsEditorModal newsItem={editingItem} onSave={handleSave} onClose={() => setEditingItem(undefined)} />}

      <div className="bg-white p-4 rounded-xl shadow-sm">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-grow max-w-4xl">
                <div className="relative flex-grow min-w-[200px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm tiêu đề tin..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary placeholder-gray-400"
                    />
                </div>
                <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="h-10 px-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary">
                    <option value="all">Tất cả thời gian</option>
                    <option value="this_month">Tháng này</option>
                    <option value="last_month">Tháng trước</option>
                </select>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)} className="h-10 px-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary">
                    <option value="all">Tất cả chủ đề</option>
                    <option value="notification">Thông báo</option>
                    <option value="plan">Kế hoạch</option>
                    <option value="event">Sự kiện</option>
                </select>
                <select value={senderFilter} onChange={e => setSenderFilter(e.target.value as any)} className="h-10 px-3 border rounded-lg bg-white border-gray-300 text-gray-900 text-sm focus:ring-primary focus:border-primary">
                    <option value="all">Tất cả người gửi</option>
                    <option value="BQT">Ban Quản Trị (BQT)</option>
                    <option value="BQLVH">Ban Quản Lý (BQL)</option>
                </select>
            </div>
            <div className="flex-shrink-0">
                <button onClick={() => setEditingItem(null)} disabled={!canManage} className="h-10 px-4 bg-primary text-white font-semibold rounded-lg flex items-center gap-2 text-sm hover:bg-primary-focus shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    <PencilSquareIcon className="w-5 h-5" /> Tin mới
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="space-y-4 flex-grow overflow-y-auto pr-2">
            {paginatedNews.map(item => (
            <div key={item.id} className={`p-4 border rounded-lg flex items-start gap-4 transition-opacity ${item.isArchived ? 'opacity-50' : ''}`}>
                {item.imageUrl && (
                    <div className="w-32 h-20 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex-grow">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${item.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.priority === 'high' ? 'Quan trọng' : 'Thông thường'}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.sender || 'BQLVH'}</span>
                </div>
                <h3 className={`font-bold text-lg mt-1 text-gray-900 ${item.isArchived ? 'line-through' : ''}`}>{item.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: item.content }} />
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                    <span>{new Date(item.date).toLocaleString('vi-VN')}</span>
                    {item.isBroadcasted && item.broadcastTime && (
                        <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircleIcon className="w-4 h-4" /> Đã gửi {timeAgo(item.broadcastTime)}</span>
                    )}
                </div>
                </div>
                {canManage && (
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleBroadcast(item.id)} disabled={item.isBroadcasted || item.isArchived} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed" data-tooltip="Gửi thông báo"><MegaphoneIcon className="w-5 h-5 text-green-600" /></button>
                    <button onClick={() => setEditingItem(item)} disabled={item.isArchived} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed" data-tooltip="Sửa"><PencilSquareIcon className="w-5 h-5 text-blue-600" /></button>
                    <button onClick={() => handleArchive(item.id)} disabled={item.isArchived} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed" data-tooltip="Lưu trữ"><ArchiveBoxIcon className="w-5 h-5 text-yellow-600" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-gray-100 rounded-full" data-tooltip="Xóa"><TrashIcon className="w-5 h-5 text-red-600" /></button>
                </div>
                )}
            </div>
            ))}
            {paginatedNews.length === 0 && (
                <div className="text-center py-10 text-gray-500">Không có tin tức nào phù hợp.</div>
            )}
        </div>
        {totalPages > 0 && (
            <div className="pt-4 mt-auto border-t flex justify-between items-center">
                <span className="text-sm text-gray-600">
                    Hiển thị {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredNews.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredNews.length)} trên tổng số {filteredNews.length} tin
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronLeftIcon /></button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button 
                            key={page} 
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-md text-sm font-semibold ${currentPage === page ? 'bg-primary text-white' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
                        >
                            {page}
                        </button>
                    ))}
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50"><ChevronRightIcon /></button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default NewsManagementPage;
