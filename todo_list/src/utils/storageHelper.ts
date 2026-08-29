/**
 * Storage Helper & Image Compression Utility
 * Prevents QuotaExceededError by compressing images to lightweight WebP/JPEG
 * and safely handling localStorage and IndexedDB fallback.
 */

// Simple IndexedDB Database Name & Store
const DB_NAME = "todo_planner_storage_db";
const DB_VERSION = 1;
const STORE_NAME = "key_val_store";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save value to IndexedDB (virtually unlimited capacity compared to 5MB localStorage)
 */
export async function idbSet(key: string, val: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB set error:", err);
  }
}

/**
 * Get value from IndexedDB
 */
export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB get error:", err);
    return null;
  }
}

/**
 * Automatically compress image file (File or Blob) using HTML Canvas
 * Reduces 5MB-10MB photos to ~30KB-80KB WebP/JPEG (98%+ size reduction)
 */
export function compressImageFile(
  file: File | Blob,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    // If it's not an image, fallback to FileReader
    if (file.type && !file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) || "";
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Try WebP first, fallback to JPEG
          let output = canvas.toDataURL("image/webp", quality);
          if (!output.startsWith("data:image/webp")) {
            output = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(output);
        } else {
          resolve(dataUrl);
        }
      };

      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };

    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/**
 * Compress raw base64 image string
 */
export function compressBase64Image(
  dataUrl: string,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.75
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        let output = canvas.toDataURL("image/webp", quality);
        if (!output.startsWith("data:image/webp")) {
          output = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(output);
      } else {
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Safe LocalStorage setter with QuotaExceededError protection and IndexedDB fallback.
 * Will NEVER crash the React application!
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    // Also mirror to IndexedDB in the background for extra resilience
    idbSet(key, value).catch(() => {});
    return true;
  } catch (err: unknown) {
    const isQuota =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");

    if (isQuota) {
      console.warn(`[Storage] LocalStorage quota exceeded for key "${key}". Saving to IndexedDB fallback.`);
      // Save full dataset into IndexedDB where quota is hundreds of MBs
      idbSet(key, value).catch((e) => console.error("IndexedDB fallback error:", e));

      // Attempt to save a sanitized lightweight version in localStorage (stripping huge embedded base64 images if it's JSON)
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const lightweight = parsed.map((item: Record<string, unknown>) => {
            const copy = { ...item };
            if (copy.imageUrl && typeof copy.imageUrl === "string" && copy.imageUrl.length > 500) {
              copy.imageUrl = ""; // stripped from localStorage cache, stored in IndexedDB
            }
            if (Array.isArray(copy.images) && copy.images.length > 0) {
              copy.images = [];
            }
            return copy;
          });
          localStorage.setItem(key, JSON.stringify(lightweight));
        }
      } catch {
        // Ignore JSON stripping errors
      }
      return false;
    }

    console.error(`[Storage] Failed to set localStorage for "${key}":`, err);
    return false;
  }
}

/**
 * Calculate approximate localStorage usage in KB / MB
 */
export function getLocalStorageUsage(): { usedBytes: number; usedKB: number; usedMB: number; percent: number } {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || "";
        totalBytes += (k.length + v.length) * 2; // UTF-16 characters = 2 bytes
      }
    }
  } catch {
    // Ignore access errors
  }

  const usedKB = Math.round(totalBytes / 1024);
  const usedMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
  // 5MB standard limit = 5242880 bytes
  const percent = Math.min(100, Math.round((totalBytes / 5242880) * 100));

  return { usedBytes: totalBytes, usedKB, usedMB, percent };
}
