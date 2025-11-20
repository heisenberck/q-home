export const SCRIPT_URLS = {
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
};

type ScriptKey = keyof typeof SCRIPT_URLS;

const loadedScripts: Partial<Record<ScriptKey, Promise<void>>> = {};

export const loadScript = (key: ScriptKey): Promise<void> => {
  if (loadedScripts[key]) {
    return loadedScripts[key]!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URLS[key];
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      console.error(`Failed to load script: ${SCRIPT_URLS[key]}`, err);
      // Remove from cache on failure to allow retries
      delete loadedScripts[key];
      reject(new Error(`Failed to load script: ${SCRIPT_URLS[key]}`));
    };
    document.body.appendChild(script);
  });

  loadedScripts[key] = promise;
  return promise;
};
