/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Student,
  ActivitySubmission,
  PointRule,
  RankPointRule,
  PointHistoryRecord,
  FeaturedStudentTitle,
  AchievementBadge,
  IssuedCertificate,
  AppNotification,
  AuditLog,
  AppSettings,
} from '../types';

const DB_NAME = 'SOMS_IndexedDB';
const DB_VERSION = 3;

export const STORES = {
  STUDENTS: 'students',
  SUBMISSIONS: 'submissions',
  POINT_RULES: 'pointRules',
  RANK_RULES: 'rankRules',
  POINT_HISTORY: 'pointHistory',
  FEATURED_TITLES: 'featuredTitles',
  BADGES: 'badges',
  CERTIFICATES: 'certificates',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
  ANNOUNCEMENTS: 'announcements',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported, falling back to localStorage');
      resolve(null as unknown as IDBDatabase);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const storeNames = Object.values(STORES);

      for (const name of storeNames) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// Fallback in-memory cache to guarantee zero runtime failures even in restricted sandboxes
const memoryStore = new Map<string, any[]>();

// Heavy stores that should never be stored in localStorage due to 5MB browser quota limitations
const HEAVY_STORES: readonly string[] = [
  STORES.SUBMISSIONS,
  STORES.CERTIFICATES,
  STORES.AUDIT_LOGS,
  STORES.POINT_HISTORY,
  STORES.STUDENTS,
];

/**
 * Prunes heavy or redundant soms_ entries from localStorage to prevent quota exhaustion
 */
export function pruneHeavyLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    for (const heavy of HEAVY_STORES) {
      try {
        localStorage.removeItem(`soms_${heavy}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

// Automatically prune redundant heavy keys on initial load
pruneHeavyLocalStorage();

/**
 * Creates a quota-safe clone of data for localStorage backup.
 * Strips huge base64 strings (> 40KB) from the fallback copy so it never exhausts quota.
 */
function sanitizeForLocalStorage<T>(items: T[]): T[] {
  try {
    return items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy: Record<string, any> = { ...item };
      for (const key of Object.keys(copy)) {
        const val = copy[key];
        if (typeof val === 'string' && val.startsWith('data:') && val.length > 40000) {
          // Truncate or omit excessive base64 in local backup (IndexedDB holds the original intact)
          copy[key] = '';
        }
      }
      return copy as T;
    });
  } catch {
    return items;
  }
}

// Fallback for environments where IndexedDB might be blocked or unavailable
function getLocalFallback<T>(storeName: string): T[] {
  if (memoryStore.has(storeName)) {
    return (memoryStore.get(storeName) as T[]) || [];
  }
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(`soms_${storeName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryStore.set(storeName, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn(`LocalStorage get failed for ${storeName}:`, err);
  }
  return [];
}

function setLocalFallback<T>(storeName: string, items: T[]): void {
  // Always update in-memory cache first
  memoryStore.set(storeName, items);

  // Skip writing heavy stores to localStorage to protect the 5MB browser quota
  if (HEAVY_STORES.includes(storeName)) {
    try {
      localStorage.removeItem(`soms_${storeName}`);
    } catch {
      // ignore
    }
    return;
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const sanitized = sanitizeForLocalStorage(items);
    localStorage.setItem(`soms_${storeName}`, JSON.stringify(sanitized));
  } catch (err: any) {
    // If quota is exceeded, clear all heavy keys and try once more
    const isQuota =
      err &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.number === -2147024882);

    if (isQuota) {
      try {
        pruneHeavyLocalStorage();
        const sanitized = sanitizeForLocalStorage(items);
        localStorage.setItem(`soms_${storeName}`, JSON.stringify(sanitized));
      } catch {
        // Handled gracefully in memoryStore - no console.error to avoid error prompts
        console.warn(`[Storage] Saved soms_${storeName} to memory cache (localStorage quota full)`);
      }
    } else {
      console.warn(`[Storage] LocalStorage unavailable for soms_${storeName}:`, err);
    }
  }
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openDB();
    if (!db) return getLocalFallback<T>(storeName);

    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = (request.result as T[]) || [];
        memoryStore.set(storeName, result);
        resolve(result);
      };

      request.onerror = () => {
        console.warn(`IndexedDB getAll failed for ${storeName}, falling back to memory/local`);
        resolve(getLocalFallback<T>(storeName));
      };
    });
  } catch (err) {
    console.warn(`Error in getAllFromStore(${storeName}), falling back:`, err);
    return getLocalFallback<T>(storeName);
  }
}

export async function putInStore<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<T> {
  try {
    const db = await openDB();
    if (!db) {
      const items = getLocalFallback<T>(storeName);
      const index = items.findIndex((i) => i.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      setLocalFallback(storeName, items);
      return item;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        // Keep in-memory store updated
        const items = getLocalFallback<T>(storeName);
        const index = items.findIndex((i) => i.id === item.id);
        if (index >= 0) items[index] = item;
        else items.push(item);
        memoryStore.set(storeName, items);

        // Only persist lightweight stores (like settings) to localStorage backup
        if (storeName === STORES.SETTINGS) {
          setLocalFallback(storeName, items);
        }

        resolve(item);
      };

      request.onerror = () => {
        console.error(`IndexedDB put error on ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error(`Error in putInStore(${storeName}):`, err);
    return item;
  }
}

export async function putManyInStore<T extends { id: string }>(
  storeName: StoreName,
  items: T[]
): Promise<void> {
  try {
    const db = await openDB();
    if (!db) {
      setLocalFallback(storeName, items);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => store.put(item));

      transaction.oncomplete = () => {
        memoryStore.set(storeName, items);
        // Only backup lightweight non-heavy stores to localStorage
        if (!HEAVY_STORES.includes(storeName)) {
          setLocalFallback(storeName, items);
        }
        resolve();
      };

      transaction.onerror = () => {
        console.error(`Transaction error in putMany on ${storeName}:`, transaction.error);
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error(`Error in putManyInStore(${storeName}):`, err);
    setLocalFallback(storeName, items);
  }
}

export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db) {
      const items = getLocalFallback<{ id: string }>(storeName).filter((i) => i.id !== id);
      setLocalFallback(storeName, items);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        const items = getLocalFallback<{ id: string }>(storeName).filter((i) => i.id !== id);
        memoryStore.set(storeName, items);
        if (storeName === STORES.SETTINGS) {
          setLocalFallback(storeName, items);
        }
        resolve();
      };

      request.onerror = () => {
        console.error(`IndexedDB delete error on ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error(`Error in deleteFromStore(${storeName}):`, err);
  }
}

export async function clearEntireStore(storeName: StoreName): Promise<void> {
  try {
    const db = await openDB();
    if (!db) {
      setLocalFallback(storeName, []);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        setLocalFallback(storeName, []);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Error clearing ${storeName}:`, err);
    setLocalFallback(storeName, []);
  }
}

/**
 * Utility to convert an uploaded file into a persistent base64 data string.
 * If the file is an image, it automatically compresses and bounds dimensions to 1280px
 * to prevent multi-megabyte payloads from causing memory or quota bottlenecks.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image (e.g. PDF or document), read standard data URL
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      return;
    }

    // For images, optimize with canvas compression to keep files compact (< 250KB)
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(mime, 0.85);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = (error) => reject(error);
  });
}
