
import React, { useState } from 'react';
import type { NewsItem } from '../../../types';
import Modal from '../../ui/Modal';
import { timeAgo } from '../../../utils/helpers';
import { ClipboardDocumentListIcon, BellIcon, CalendarDaysIcon, SparklesIcon, MegaphoneIcon, XMarkIcon } from '../../ui/Icons';
import { useNews } from '../../../hooks/useNews';
import Spinner from '../../ui/Spinner';

const NewsDetailPage: React.FC<{ item: NewsItem, onClose: () => void }> = ({ item, onClose }) => {
    return (
        <Modal title={item.title} onClose={onClose} size="lg">
            <div className="space-y-4 -mt-2">
                {item.imageUrl && (
                    <div className="rounded-xl overflow-hidden shadow-md">
                        <img src={item.imageUrl} alt={item.title} className="w-full h-auto object-cover" />
                    </div>
                )}
                <div className="flex items-center justify-between py-1 border-b">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.category}</span>
                    <p className="text-[10px] text-gray-400 font-bold">{new Date(item.date).toLocaleString('vi-VN')}</p>
                </div>
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: item.content }} />
            </div>
        </Modal>
    )
}

const NewsCategoryIcon: React.FC<{ category: NewsItem['category'] }> = ({ category }) => {
    switch (category) {
        case 'notification': return <MegaphoneIcon className="w-5 h-5 text-blue-500" />;
        case 'plan': return <CalendarDaysIcon className="w-5 h-5 text-orange-500" />;
        case 'event': return <SparklesIcon className="w-5 h-5 text-purple-500" />;
        default: return <ClipboardDocumentListIcon className="w-5 h-5 text-gray-500" />;
    }
};

const PortalNewsPage: React.FC = () => {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { news, loading } = useNews();

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <Spinner />
              <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Đang tải tin tức...</p>
          </div>
      );
  }

  return (
    <div className="p-5 space-y-4">
        {selectedNews && <NewsDetailPage item={selectedNews} onClose={() => setSelectedNews(null)} />}
        
        {news.length > 0 ? (
            news.filter(item => !item.isArchived).map(item => (
                <div key={item.id} onClick={() => setSelectedNews(item)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all flex gap-4 items-start hover:border-primary/30">
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-50 rounded-lg">
                                <NewsCategoryIcon category={item.category} />
                            </div>
                            {item.priority === 'high' && (
                                <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase">Ưu tiên</span>
                            )}
                        </div>
                        <h2 className="font-black text-gray-800 text-sm mt-3 leading-snug line-clamp-2">{item.title}</h2>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tight">{timeAgo(item.date)}</p>
                    </div>
                    {item.imageUrl && (
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            ))
        ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-200">
                    <BellIcon className="w-10 h-10" />
                </div>
                <p className="text-sm font-bold text-gray-400">Không có tin tức nào để hiển thị.</p>
            </div>
        )}
    </div>
  );
};

export default PortalNewsPage;
