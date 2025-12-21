import React, { useState } from 'react';
import type { NewsItem } from '../../../types';
import Modal from '../../ui/Modal';
import { timeAgo } from '../../../utils/helpers';
import { ClipboardDocumentListIcon, BellIcon, CalendarDaysIcon, SparklesIcon, MegaphoneIcon } from '../../ui/Icons';


interface PortalNewsPageProps {
  news: NewsItem[];
}

const NewsDetailPage: React.FC<{ item: NewsItem, onClose: () => void }> = ({ item, onClose }) => {
    return (
        <Modal title={item.title} onClose={onClose} size="lg">
            <div className="space-y-4">
                {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover rounded-lg" />}
                <p className="text-sm text-gray-500">{new Date(item.date).toLocaleString('vi-VN')}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>
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


const PortalNewsPage: React.FC<PortalNewsPageProps> = ({ news }) => {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  return (
    <div className="p-4 space-y-4">
        {selectedNews && <NewsDetailPage item={selectedNews} onClose={() => setSelectedNews(null)} />}
        
      {news.filter(item => !item.isArchived).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => (
        <div key={item.id} onClick={() => setSelectedNews(item)} className="bg-white p-4 rounded-xl shadow-sm border cursor-pointer hover:border-primary flex gap-4 items-start">
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <NewsCategoryIcon category={item.category} />
                {item.sender && <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{item.sender}</span>}
                {item.priority === 'high' && (
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">QUAN TRỌNG</span>
                )}
              </div>
              <h2 className="font-bold text-lg mt-1">{item.title}</h2>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
              <p className="text-xs text-gray-400 mt-2">{timeAgo(item.date)}</p>
            </div>
            {item.imageUrl && (
                <div className="w-24 h-24 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
            )}
        </div>
      ))}
    </div>
  );
};

export default PortalNewsPage;