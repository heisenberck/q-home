// utils/env.ts

export const isProduction = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const hostname = window.location.hostname;
  return hostname.includes('vercel.app') || hostname.includes('q-home.vn');
};