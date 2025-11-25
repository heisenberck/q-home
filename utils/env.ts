// utils/env.ts

export const isProduction = (): boolean => {
  // Guard against server-side rendering environments where `window` is not defined.
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  
  // Define production domains here.
  const productionHostnames = ['vercel.app', 'q-home.vn'];

  // Consider it production if the hostname includes any of the specified production domains.
  return productionHostnames.some(prodHost => hostname.includes(prodHost));
};
