
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { safeGetDocs } from '../utils/firestore-guard';

const CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes

export const useResidents = () => {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Refs to track pagination state without triggering re-renders
  const lastDocRef = useRef(null);
  const lastFetchTime = useRef(0);
  const isFetchingRef = useRef(false);

  const fetchResidents = useCallback(async (isNextPage = false) => {
    // Prevent double fetching
    if (isFetchingRef.current) return;
    
    // Simple Cache Check: If data exists, it's fresh, and we aren't asking for more pages
    const now = Date.now();
    if (!isNextPage && residents.length > 0 && (now - lastFetchTime.current < CACHE_DURATION)) {
      console.log('[useResidents] Using Cached Data');
      return; 
    }

    setLoading(true);
    setError(null);
    isFetchingRef.current = true;

    try {
      const collectionRef = collection(db, 'residents');
      
      // Query Construction
      let constraints = [
        orderBy('name'), 
        limit(20) 
      ];

      if (isNextPage && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      }

      const q = query(collectionRef, ...constraints);

      // USES THE GUARDED FETCH
      const snapshot = await safeGetDocs(q);

      const newResidents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
          // Note: Sub-collections are NOT fetched here to save quota
        };
      });

      // Update Pagination Cursor
      if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      
      lastFetchTime.current = Date.now();
      
      if (snapshot.docs.length < 20) {
        setHasMore(false);
      }

      setResidents(prev => isNextPage ? [...prev, ...newResidents] : newResidents);

    } catch (err) {
      console.error("Error fetching residents:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [residents.length]);

  // Initial Fetch on Mount
  useEffect(() => {
    fetchResidents(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { 
    residents, 
    loading, 
    error, 
    hasMore, 
    loadMore: () => fetchResidents(true) 
  };
};
