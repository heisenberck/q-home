
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { NewsItem } from '../types';

export const useNews = (maxItems?: number) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let q = query(collection(db, 'news'), orderBy('date', 'desc'));
        
        if (maxItems) {
            q = query(collection(db, 'news'), orderBy('date', 'desc'), limit(maxItems));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as NewsItem[];
            setNews(items);
            setLoading(false);
        }, (err) => {
            console.error("News listener error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [maxItems]);

    return { news, loading };
};
