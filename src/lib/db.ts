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
const DB_VERSION = 2;

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

// Fallback for environments where IndexedDB might be blocked
function getLocalFallback<T>(storeName: string): T[] {
  try {
    const raw = localStorage.getItem(`soms_${storeName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('LocalStorage get error', err);
    return [];
  }
}

function setLocalFallback<T>(storeName: string, items: T[]): void {
  try {
    localStorage.setItem(`soms_${storeName}`, JSON.stringify(items));
  } catch (err) {
    console.error('LocalStorage set error', err);
  }
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openDB();
    if (!db) return getLocalFallback<T>(storeName);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as T[]);
      };

      request.onerror = () => {
        console.warn(`IndexedDB getAll failed for ${storeName}, falling back to localStorage`);
        resolve(getLocalFallback<T>(storeName));
      };
    });
  } catch (err) {
    console.error(`Error in getAllFromStore(${storeName}):`, err);
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
        // Also keep localStorage updated for backup
        const items = getLocalFallback<T>(storeName);
        const index = items.findIndex((i) => i.id === item.id);
        if (index >= 0) items[index] = item;
        else items.push(item);
        setLocalFallback(storeName, items);
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
        setLocalFallback(storeName, items);
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
        setLocalFallback(storeName, items);
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
 * Utility to convert an uploaded file into a persistent base64 data string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
