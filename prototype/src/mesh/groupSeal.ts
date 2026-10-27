/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Scellement de groupe des trames Bluetooth (V0.3). Identique à Android : mesh/GroupSeal.kt.
 *
 *   kg(jour)  = HKDF-SHA256(code du groupe, sel "MESHORA-BLE-v1", info "frame|<jour>")
 *   kid(jour) = HKDF-SHA256(code du groupe, sel "MESHORA-BLE-v1", info "id|<jour>")
 *   clair     = type intérieur (1) | longueur (2, BE) | données | zéros jusqu'à un multiple de 128
 *   scellé    = 0x01 | jour (4, BE) | IV (12) | AES-256-GCM(kg, IV, clair, données associées = 0x01 | jour)
 *   id trame  = HMAC-SHA256(kid, étiquette)[0..16)
 * Un étranger au groupe ne voit ni nom, ni clé publique, ni type, ni taille exacte.
 */
import { FrameType, ID_SIZE } from './meshFrame';

const enc = new TextEncoder();
const SALT = enc.encode('MESHORA-BLE-v1');
const PAD = 128;
const HEADER = 17;
export const DAY_MS = 86_400_000;
export const dayOf = (ms: number) => Math.floor(ms / DAY_MS);

async function hkdf(room: string, info: string): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey('raw', enc.encode(room), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: enc.encode(info) }, ikm, 256);
  return new Uint8Array(bits);
}

export const frameKey = (room: string, day: number) => hkdf(room, `frame|${day}`);
export const idKey = (room: string, day: number) => hkdf(room, `id|${day}`);

export async function frameId(room: string, day: number, label: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', await idKey(room, day), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(label))).slice(0, ID_SIZE);
}

function aadFor(day: number): Uint8Array {
  const a = new Uint8Array(5);
  a[0] = 1;
  new DataView(a.buffer).setUint32(1, day);
  return a;
}

export async function seal(room: string, day: number, inner: FrameType, data: Uint8Array, iv: Uint8Array = crypto.getRandomValues(new Uint8Array(12))): Promise<Uint8Array> {
  if (data.length > 0xffff) throw new Error('données trop grandes');
  const len = 3 + data.length;
  const plain = new Uint8Array(len + ((PAD - (len % PAD)) % PAD));
  plain[0] = inner;
  plain[1] = data.length >> 8;
  plain[2] = data.length & 0xff;
  plain.set(data, 3);
  const aad = aadFor(day);
  const key = await crypto.subtle.importKey('raw', await frameKey(room, day), 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plain));
  const out = new Uint8Array(HEADER + ct.length);
  out.set(aad, 0);
  out.set(iv, 5);
  out.set(ct, HEADER);
  return out;
}

/** Type intérieur et données, ou null (autre groupe, trop ancienne, altérée). */
export async function open(room: string, sealed: Uint8Array, nowMs = Date.now()): Promise<{ type: FrameType; data: Uint8Array } | null> {
  if (sealed.length < HEADER + 16 + PAD || sealed[0] !== 1) return null;
  const day = new DataView(sealed.buffer, sealed.byteOffset + 1, 4).getUint32(0);
  if (Math.abs(day - dayOf(nowMs)) > 1) return null;
  try {
    const key = await crypto.subtle.importKey('raw', await frameKey(room, day), 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(5, 17), additionalData: sealed.slice(0, 5) }, key, sealed.slice(HEADER))
    );
    const type = plain[0] as FrameType;
    if (type !== FrameType.ENVELOPE && type !== FrameType.ACK && type !== FrameType.ANNOUNCE) return null;
    const len = (plain[1] << 8) | plain[2];
    if (3 + len > plain.length) return null;
    return { type, data: plain.slice(3, 3 + len) };
  } catch {
    return null;
  }
}
