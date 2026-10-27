/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Effacement d'urgence (navigateur).
 * Efface sur CET appareil : identité (clé privée), messages, file d'envoi, contacts, groupe, réglages, cartes,
 * bases IndexedDB, caches hors ligne et service worker. Irréversible. Ne peut rien effacer chez les destinataires
 * ni sur le relais (où les messages en attente sont chiffrés et expirent au plus tard après 24 h).
 */
export async function panicWipe(): Promise<{ localKeys: number; databases: number; caches: number }> {
  let localKeys = 0, databases = 0, cachesDeleted = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('meshora')) { localStorage.removeItem(k); localKeys++; }
    }
    localStorage.clear(); // l'origine /app n'héberge que MESHORA
  } catch {}
  try { sessionStorage.clear(); } catch {}
  try {
    const anyIdb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
    const list = anyIdb.databases ? await anyIdb.databases() : [];
    for (const d of list) {
      if (d.name) { await new Promise<void>((r) => { const q = indexedDB.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = () => r(); }); databases++; }
    }
  } catch {}
  try {
    if ('caches' in globalThis) for (const n of await caches.keys()) { await caches.delete(n); cachesDeleted++; }
  } catch {}
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  } catch {}
  return { localKeys, databases, caches: cachesDeleted };
}
