/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Trame du maillage v1, identique à android/app/src/main/java/org/meshora/app/mesh/MeshFrame.kt
 * (docs/MESH-NATIF-V0.3.md §3) : en-tête de 26 octets, gros-boutiste.
 *   version(1) type(1) ttl(1) flags(1) messageId(16) fragIndex(2) fragCount(2) payloadLength(2) payload(n)
 */

export const MESH_SERVICE_UUID = '120689f9-ed0b-4ef8-a491-cc457d12b459';
export const MESH_CHAR_RX_UUID = '8168e5af-7c92-4c8a-a685-a33a570a1a83'; // écriture vers le périphérique
export const MESH_CHAR_TX_UUID = 'e156230b-847c-42a1-a71c-d05348a61451'; // notifications du périphérique

export const FRAME_VERSION = 1;
export const ID_SIZE = 16;
export const HEADER_SIZE = 26;
export const MAX_TTL = 7;
export const MAX_FRAGMENTS = 256;

export enum FrameType {
  ENVELOPE = 1,
  ACK = 2,
  ANNOUNCE = 3,
  /** V0.3 : charge utile scellée par la clé du groupe (groupSeal.ts) ; le vrai type est chiffré à l'intérieur. */
  SEALED = 4
}

export interface MeshFrame {
  type: FrameType;
  ttl: number;
  flags: number;
  messageId: Uint8Array;
  fragIndex: number;
  fragCount: number;
  payload: Uint8Array;
}

export function encodeFrame(f: MeshFrame): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + f.payload.length);
  const v = new DataView(out.buffer);
  out[0] = FRAME_VERSION;
  out[1] = f.type;
  out[2] = f.ttl;
  out[3] = f.flags;
  out.set(f.messageId, 4);
  v.setUint16(20, f.fragIndex);
  v.setUint16(22, f.fragCount);
  v.setUint16(24, f.payload.length);
  out.set(f.payload, HEADER_SIZE);
  return out;
}

/** Décode une trame ; null pour toute entrée invalide. */
export function decodeFrame(bytes: Uint8Array): MeshFrame | null {
  if (bytes.length < HEADER_SIZE) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== FRAME_VERSION) return null;
  const type = bytes[1];
  if (type !== FrameType.ENVELOPE && type !== FrameType.ACK && type !== FrameType.ANNOUNCE && type !== FrameType.SEALED) return null;
  const ttl = bytes[2];
  const flags = bytes[3];
  const fragIndex = v.getUint16(20);
  const fragCount = v.getUint16(22);
  const length = v.getUint16(24);
  if (bytes.length !== HEADER_SIZE + length) return null;
  if (ttl > MAX_TTL || fragCount < 1 || fragCount > MAX_FRAGMENTS || fragIndex >= fragCount) return null;
  return {
    type,
    ttl,
    flags,
    messageId: bytes.slice(4, 4 + ID_SIZE),
    fragIndex,
    fragCount,
    payload: bytes.slice(HEADER_SIZE)
  };
}

export function splitFrames(type: FrameType, messageId: Uint8Array, payload: Uint8Array, ttl: number, maxFrameSize: number): MeshFrame[] {
  const chunk = maxFrameSize - HEADER_SIZE;
  if (chunk < 1) throw new Error('taille de trame trop petite');
  const count = Math.max(1, Math.ceil(payload.length / chunk));
  if (count > MAX_FRAGMENTS) throw new Error('message trop grand');
  const frames: MeshFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push({ type, ttl, flags: 0, messageId, fragIndex: i, fragCount: count, payload: payload.slice(i * chunk, Math.min(payload.length, (i + 1) * chunk)) });
  }
  return frames;
}

export const idHex = (id: Uint8Array) => Array.from(id, (b) => b.toString(16).padStart(2, '0')).join('');

/** Réassemblage borné (30 s, 64 Kio, 64 messages simultanés), comme sur Android. */
export class Reassembler {
  private pending = new Map<string, { count: number; type: FrameType; parts: (Uint8Array | null)[]; bytes: number; received: number; at: number }>();
  private rejected = new Map<string, number>();

  constructor(private timeoutMs = 30000, private maxBytes = 64 * 1024, private maxConcurrent = 64) {}

  accept(f: MeshFrame): Uint8Array | null {
    const now = Date.now();
    for (const [k, p] of this.pending) if (p.at < now - this.timeoutMs) this.pending.delete(k);
    for (const [k, at] of this.rejected) if (at < now - this.timeoutMs) this.rejected.delete(k);
    if (f.fragCount === 1) return f.payload;
    const key = idHex(f.messageId);
    if (this.rejected.has(key)) return null;
    let p = this.pending.get(key);
    if (!p) {
      if (this.pending.size >= this.maxConcurrent) this.pending.delete(this.pending.keys().next().value!);
      p = { count: f.fragCount, type: f.type, parts: new Array(f.fragCount).fill(null), bytes: 0, received: 0, at: now };
      this.pending.set(key, p);
    }
    if (p.count !== f.fragCount || p.type !== f.type || p.bytes + f.payload.length > this.maxBytes) {
      this.pending.delete(key);
      this.rejected.set(key, now);
      return null;
    }
    if (p.parts[f.fragIndex]) return null;
    p.parts[f.fragIndex] = f.payload;
    p.bytes += f.payload.length;
    p.received++;
    if (p.received < p.count) return null;
    this.pending.delete(key);
    const out = new Uint8Array(p.bytes);
    let off = 0;
    for (const part of p.parts) {
      out.set(part!, off);
      off += part!.length;
    }
    return out;
  }
}
