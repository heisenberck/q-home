// Fix: Removed references to 'vite/client' and 'vite-plugin-pwa/client' because the type definition files 
// were not found in the environment, causing compilation errors. 
// Manual declarations for ImportMeta and common asset types are provided below instead.

// These declarations extend the standard Vite environment types.
declare interface ImportMetaEnv {
  readonly [key: string]: any;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declaring modules for static assets to resolve import errors for image files
declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}
