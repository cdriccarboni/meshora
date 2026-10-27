/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Invitations (format identique à Android : android/.../invite/Invitation.kt).
 *
 *   https://<site>/app/#join=<groupe>&k=<clé publique hex>&n=<nom>[&r=<relais wss>]
 *
 * Les paramètres sont dans le fragment (#) : jamais envoyés au serveur du site.
 * La clé de l'invitant, reçue hors du relais, devient un contact « vérifié ».
 */
import { isAcceptableRelayUrl } from './urlHygiene';

export interface Invitation {
  room: string;
  publicKeyHex: string;
  alias: string;
  relayUrl: string | null;
}

export interface Contact {
  publicKeyHex: string;
  alias: string;
  verified: boolean;
  addedAt: number;
}

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[0-9a-f]{120,400}$/;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Relais de référence (préproduction tant que la production n'est pas validée). */
export const DEFAULT_RELAY_URL: string =
  ((import.meta as any).env?.VITE_MESHORA_RELAY as string | undefined) || 'wss://meshora-relay-preprod.acousmaticregietools.workers.dev';

export const isValidRoom = (room: string) => ROOM_RE.test(room);

export function newRoomCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'g' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const enc = (s: string) => encodeURIComponent(s);

export function invitationLink(inv: Invitation, base: string): string {
  let s = base.split('#')[0] + '#join=' + inv.room + '&k=' + inv.publicKeyHex;
  if (inv.alias.trim()) s += '&n=' + enc(inv.alias);
  if (inv.relayUrl) s += '&r=' + enc(inv.relayUrl);
  return s;
}

export function parseInvitation(link: string): Invitation | null {
  const text = (link || '').trim();
  if (!text || text.length > 2048) return null;
  const hashIdx = text.indexOf('#');
  const qIdx = text.indexOf('?');
  const params = hashIdx >= 0 ? text.slice(hashIdx + 1) : qIdx >= 0 ? text.slice(qIdx + 1) : '';
  if (!params) return null;
  const map = new Map<string, string>();
  for (const part of params.split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      map.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {}
  }
  const room = map.get('join');
  if (!room || !isValidRoom(room)) return null;
  const key = (map.get('k') || '').trim().toLowerCase();
  if (!KEY_RE.test(key) || key.length % 2) return null;
  const alias = (map.get('n') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
  const relay = map.get('r') || null;
  if (relay && !(relay.startsWith('wss://') || /^ws:\/\/(localhost|127\.0\.0\.1)/.test(relay))) return null;
  if (relay && !isAcceptableRelayUrl(relay)) return null;
  return { room, publicKeyHex: key, alias, relayUrl: relay };
}

// ---------- contacts (navigateur) ----------
const CONTACTS_KEY = 'meshora_contacts';

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.publicKeyHex === 'string') : [];
  } catch {
    return [];
  }
}

export function upsertContact(publicKeyHex: string, alias: string, verified: boolean): void {
  const list = loadContacts();
  const prev = list.find((c) => c.publicKeyHex === publicKeyHex);
  const next: Contact = {
    publicKeyHex,
    alias: alias.trim().slice(0, 40) || publicKeyHex.slice(-8),
    verified: verified || !!prev?.verified,
    addedAt: prev?.addedAt || Date.now()
  };
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify([...list.filter((c) => c.publicKeyHex !== publicKeyHex), next]));
  } catch {}
}

export function isVerifiedKey(publicKeyHex: string): boolean {
  return loadContacts().some((c) => c.publicKeyHex === publicKeyHex && c.verified);
}

// ---------- groupe (salon) du navigateur ----------
const ROOM_KEY = 'meshora_room';

export function getOrCreateRoom(): string {
  try {
    const r = localStorage.getItem(ROOM_KEY);
    if (r && isValidRoom(r)) return r;
    const n = newRoomCode();
    localStorage.setItem(ROOM_KEY, n);
    return n;
  } catch {
    return newRoomCode();
  }
}

export function setRoom(room: string): void {
  if (!isValidRoom(room)) return;
  try {
    localStorage.setItem(ROOM_KEY, room);
  } catch {}
}

/** Adresse de connexion = relais + ?room=<groupe>. */
export function withRoom(relayBase: string, room: string): string {
  try {
    const u = new URL(relayBase);
    u.searchParams.set('room', room);
    return u.toString();
  } catch {
    return relayBase;
  }
}
