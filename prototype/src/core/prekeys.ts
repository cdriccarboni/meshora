/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA V0.4 étape A — magasin des prékeys de réception (confidentialité persistante à la semaine).
 *
 * - Une nouvelle prékey tous les 7 jours ; annoncée avec une échéance à 8 jours (chevauchement).
 * - Sa clé privée est EFFACÉE 7 jours après l'échéance (délai de grâce : courrier différé de 24 h,
 *   téléphones restés hors ligne). Au-delà, les messages captés qui lui étaient destinés sont illisibles,
 *   même pour qui volerait l'appareil.
 * - Les prékeys des autres (vérifiées) sont gardées jusqu'à leur échéance ; sans prékey valide → enveloppe v2.
 */
import { MeshoraCrypto, SignedPrekey } from './crypto';

export const PREKEY_ROTATE_MS = 7 * 24 * 3600 * 1000;
export const PREKEY_VALID_MS = 8 * 24 * 3600 * 1000;
export const PREKEY_GRACE_MS = 7 * 24 * 3600 * 1000;
const OWN_KEY = 'meshora_prekeys_v1';
const PEERS_KEY = 'meshora_peer_prekeys_v1';
const MAX_OWN = 6;
const MAX_PEERS = 500;

export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const browserStore: KVStore = {
  get: (k) => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    } catch {}
  }
};

interface OwnPrekey extends SignedPrekey {
  createdAt: number;
  privateKeyPkcs8Hex: string;
  identity: string;
}

function readJson<T>(store: KVStore, key: string, fallback: T): T {
  try {
    const raw = store.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export class PrekeyStore {
  constructor(private store: KVStore = browserStore, private clock: () => number = Date.now) {}

  private own(): OwnPrekey[] {
    const list = readJson<OwnPrekey[]>(this.store, OWN_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  /** Efface les prékeys privées dont l'échéance + délai de grâce est passée. Renvoie le nombre effacé. */
  purge(): number {
    const now = this.clock();
    const all = this.own();
    const keep = all.filter((k) => k.expiresAt + PREKEY_GRACE_MS > now).slice(-MAX_OWN);
    if (keep.length !== all.length) this.store.set(OWN_KEY, JSON.stringify(keep));
    return all.length - keep.length;
  }

  /** Prékey à annoncer (en crée une nouvelle si la plus récente a plus de 7 jours ou appartient à une autre identité). */
  async current(identityPrivateKey: CryptoKey, identityPublicKeyHex: string): Promise<SignedPrekey> {
    this.purge();
    const now = this.clock();
    let list = this.own().filter((k) => k.identity === identityPublicKeyHex);
    const latest = list[list.length - 1];
    if (latest && now - latest.createdAt < PREKEY_ROTATE_MS && latest.expiresAt > now) return strip(latest);
    const { prekey, privateKeyPkcs8Hex } = await MeshoraCrypto.generatePrekey(identityPrivateKey, identityPublicKeyHex, now + PREKEY_VALID_MS);
    list = [...list, { ...prekey, createdAt: now, privateKeyPkcs8Hex, identity: identityPublicKeyHex }].slice(-MAX_OWN);
    this.store.set(OWN_KEY, JSON.stringify(list));
    return prekey;
  }

  /** Clé privée d'une de MES prékeys encore conservées, ou null (jamais créée, ou déjà effacée). */
  privateFor(prekeyId: string): string | null {
    this.purge();
    return this.own().find((k) => k.id === prekeyId)?.privateKeyPkcs8Hex ?? null;
  }

  /** Mémorise la prékey annoncée par une identité, seulement si elle est valide. */
  async rememberPeer(identityPublicKeyHex: string, prekey: unknown): Promise<boolean> {
    if (!prekey || !(await MeshoraCrypto.verifyPrekey(identityPublicKeyHex, prekey, this.clock()))) return false;
    const p = prekey as SignedPrekey;
    const map = readJson<Record<string, SignedPrekey>>(this.store, PEERS_KEY, {});
    const old = map[identityPublicKeyHex];
    if (old && old.expiresAt >= p.expiresAt) return true; // ne jamais revenir à une prékey plus ancienne
    map[identityPublicKeyHex] = { publicKeyHex: p.publicKeyHex, id: p.id, expiresAt: p.expiresAt, signatureHex: p.signatureHex };
    const now = this.clock();
    const entries = Object.entries(map).filter(([, v]) => v.expiresAt > now);
    this.store.set(PEERS_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_PEERS))));
    return true;
  }

  /** Prékey valide connue pour ce destinataire, ou null → enveloppe v2. */
  peer(identityPublicKeyHex: string): SignedPrekey | null {
    const p = readJson<Record<string, SignedPrekey>>(this.store, PEERS_KEY, {})[identityPublicKeyHex];
    return p && p.expiresAt > this.clock() ? p : null;
  }
}

function strip(k: OwnPrekey): SignedPrekey {
  return { publicKeyHex: k.publicKeyHex, id: k.id, expiresAt: k.expiresAt, signatureHex: k.signatureHex };
}

/** Instance partagée de l'application (stockage du navigateur). */
export const prekeys = new PrekeyStore();
