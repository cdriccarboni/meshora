/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Bluetooth LE depuis le navigateur (Web Bluetooth, rôle central uniquement).
 *
 * Permet à un ordinateur (Chrome, Edge) de se relier en Bluetooth, SANS Internet, à un téléphone Android
 * qui exécute MESHORA avec « Bluetooth MESHORA » activé (le téléphone joue le rôle de périphérique GATT).
 * Même trame (src/mesh/meshFrame.ts), mêmes enveloppes chiffrées, mêmes accusés v2 et mêmes annonces
 * signées que l'application Android (docs/MESH-NATIF-V0.3.md, docs/PROTOCOLE-V0.2.md).
 *
 * Limites : un seul téléphone relié à la fois ; la connexion exige un geste de l'utilisateur
 * (choix de l'appareil dans la fenêtre du navigateur) ; Safari et Firefox ne prennent pas en charge Web Bluetooth.
 */

import { MeshMessage, MeshPeer, MessageAck } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { ensureCryptographicIdentity } from '../core/identity';
import { MeshoraCrypto, EncryptedEnvelope, SignedAck } from '../core/crypto';
import {
  MESH_SERVICE_UUID, MESH_CHAR_RX_UUID, MESH_CHAR_TX_UUID, FrameType, MAX_TTL, ID_SIZE,
  Reassembler, decodeFrame, encodeFrame, splitFrames, idHex
} from '../mesh/meshFrame';
import { seal, open as openSealed, frameId, dayOf } from '../mesh/groupSeal';
import { getOrCreateRoom } from '../core/invitation';

/** Taille de trame prudente pour les écritures (tient dans une MTU négociée ≥ 185). */
const FRAME_SIZE = 180;
const ANNOUNCE_MS = 20000;
const ANNOUNCE_MAX_AGE_MS = 10 * 60 * 1000;
const PEER_TTL_MS = 90000;

interface AnnouncePayload {
  publicKey: string;
  alias: string;
  timestamp: number;
  signature: string;
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();
const announceString = (pub: string, alias: string, ts: number) => `MESHORA-ANNOUNCE|v1|${pub}|${alias}|${ts}`;
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
}

export type BluetoothState = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'error';

export class WebBluetoothTransport implements ITransportAdapter {
  public id = 'transport_web_bluetooth';
  public name = 'Bluetooth (navigateur ↔ téléphone)';
  public type = 'bluetooth' as const;

  private device: any = null;
  private rx: any = null;
  private tx: any = null;
  private connected = false;
  private writeChain: Promise<unknown> = Promise.resolve();
  private reassembler = new Reassembler();
  private seen = new Map<string, number>();
  private peers = new Map<string, MeshPeer & { publicKey: string }>();
  private sentTo = new Map<string, Map<string, string>>();
  private announceTimer: ReturnType<typeof setInterval> | null = null;

  private messageListeners = new Set<(m: MeshMessage) => void>();
  private ackListeners = new Set<(a: MessageAck) => void>();
  private peersListeners = new Set<() => void>();
  private stateListeners = new Set<(s: BluetoothState, detail: string) => void>();
  private state: BluetoothState = WebBluetoothTransport.isSupported() ? 'idle' : 'unsupported';
  private detail = WebBluetoothTransport.isSupported()
    ? 'Non relié.'
    : 'Ce navigateur ne prend pas en charge Web Bluetooth (utiliser Chrome ou Edge sur ordinateur).';

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth && typeof window !== 'undefined' && window.isSecureContext;
  }

  // ------------------------------------------------------------------ état

  public getState(): { state: BluetoothState; detail: string; peers: number } {
    return { state: this.state, detail: this.detail, peers: this.livePeers().length };
  }

  public onStateChange(cb: (s: BluetoothState, detail: string) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onPeersChanged(cb: () => void): () => void {
    this.peersListeners.add(cb);
    return () => this.peersListeners.delete(cb);
  }

  private setState(s: BluetoothState, detail: string) {
    this.state = s;
    this.detail = detail;
    this.stateListeners.forEach((l) => { try { l(s, detail); } catch {} });
  }

  private livePeers() {
    const now = Date.now();
    return Array.from(this.peers.values()).filter((p) => now - p.lastSeen < PEER_TTL_MS);
  }

  // ------------------------------------------------------------------ connexion (geste utilisateur requis)

  public async connect(): Promise<boolean> {
    if (!WebBluetoothTransport.isSupported()) return false;
    try {
      this.setState('connecting', 'Choisissez le téléphone MESHORA dans la fenêtre du navigateur…');
      const device = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: [MESH_SERVICE_UUID] }] });
      this.device = device;
      device.addEventListener('gattserverdisconnected', () => this.onDisconnected());
      this.setState('connecting', `Connexion à ${device.name || 'téléphone MESHORA'}…`);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(MESH_SERVICE_UUID);
      this.rx = await service.getCharacteristic(MESH_CHAR_RX_UUID);
      this.tx = await service.getCharacteristic(MESH_CHAR_TX_UUID);
      this.tx.addEventListener('characteristicvaluechanged', (e: any) => {
        const dv: DataView = e.target.value;
        void this.onBytes(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice());
      });
      await this.tx.startNotifications();
      this.connected = true;
      this.setState('connected', `Relié en Bluetooth à ${device.name || 'un téléphone MESHORA'}.`);
      await this.announce();
      if (this.announceTimer) clearInterval(this.announceTimer);
      this.announceTimer = setInterval(() => { void this.announce(); }, ANNOUNCE_MS);
      return true;
    } catch (err: any) {
      this.connected = false;
      const name = err?.name || '';
      const msg = name === 'NotFoundError'
        ? 'Aucun téléphone choisi (ou aucun téléphone MESHORA avec Bluetooth activé à proximité).'
        : `Connexion Bluetooth impossible : ${err?.message || err}`;
      this.setState(name === 'NotFoundError' ? 'idle' : 'error', msg);
      return false;
    }
  }

  public disconnect(): void {
    try { this.device?.gatt?.disconnect(); } catch {}
    this.onDisconnected();
  }

  private onDisconnected() {
    this.connected = false;
    this.rx = null;
    this.tx = null;
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.announceTimer = null;
    this.peers.clear();
    this.peersListeners.forEach((l) => { try { l(); } catch {} });
    if (this.state !== 'unsupported') this.setState('idle', 'Bluetooth déconnecté.');
  }

  // ------------------------------------------------------------------ ITransportAdapter

  public isAvailable(): boolean {
    return this.connected && !!this.rx;
  }

  public isNativeRequired(): boolean {
    return false;
  }

  public onMessage(cb: (m: MeshMessage) => void): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public onAck(cb: (a: MessageAck) => void): () => void {
    this.ackListeners.add(cb);
    return () => this.ackListeners.delete(cb);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    return this.livePeers();
  }

  /** Une enveloppe chiffrée par pair Bluetooth connu (annonce signée reçue). Jamais de clair. */
  public async send(message: MeshMessage): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const me = await ensureCryptographicIdentity();
    if (!me.privateKeyPkcs8Hex) return false;
    let targets = this.livePeers();
    if (message.recipientId && message.recipientId !== 'broadcast') targets = targets.filter((p) => p.id === message.recipientId);
    if (targets.length === 0) return false;
    const priv = await MeshoraCrypto.importPrivateKey(me.privateKeyPkcs8Hex);
    const recipients = this.sentTo.get(message.id) ?? new Map<string, string>();
    let sentAny = false;
    for (const peer of targets) {
      const envelope = await MeshoraCrypto.encryptEnvelope({
        messageId: message.id,
        senderPrivateKey: priv,
        senderPublicKeyHex: me.publicKey,
        recipientPublicKeyHex: peer.publicKey,
        plaintext: message.content
      });
      const hash = await MeshoraCrypto.envelopeHash(envelope);
      recipients.set(hash, peer.publicKey);
      const ok = await this.sendSealed(FrameType.ENVELOPE, utf8.encode(JSON.stringify(envelope)), MAX_TTL, 'env|' + hash);
      sentAny = sentAny || ok;
    }
    this.sentTo.set(message.id, recipients);
    if (this.sentTo.size > 500) this.sentTo.delete(this.sentTo.keys().next().value!);
    return sentAny;
  }

  // ------------------------------------------------------------------ émission

  /**
   * V0.3 : toute charge utile part SCELLÉE par la clé du groupe (groupSeal.ts) : ni nom, ni clé publique,
   * ni type en clair sur l'air ; identifiant de trame illisible hors du groupe.
   */
  private async sendSealed(inner: FrameType, data: Uint8Array, ttl: number, idLabel: string | null): Promise<boolean> {
    const room = getOrCreateRoom();
    const day = dayOf(Date.now());
    const sealed = await seal(room, day, inner, data);
    const id = idLabel ? await frameId(room, day, idLabel) : crypto.getRandomValues(new Uint8Array(ID_SIZE));
    return this.sendPayload(FrameType.SEALED, sealed, ttl, id);
  }

  private async sendPayload(type: FrameType, payload: Uint8Array, ttl: number, messageId: Uint8Array): Promise<boolean> {
    if (!this.rx) return false;
    this.seen.set(idHex(messageId), Date.now()); // pas d'écho
    const frames = splitFrames(type, messageId, payload, ttl, FRAME_SIZE);
    const rx = this.rx;
    const job = this.writeChain.then(async () => {
      for (const f of frames) await rx.writeValueWithResponse(encodeFrame(f));
    });
    this.writeChain = job.catch(() => {});
    try {
      await job;
      return true;
    } catch {
      return false;
    }
  }

  private async announce(): Promise<void> {
    if (!this.isAvailable()) return;
    const me = await ensureCryptographicIdentity();
    if (!me.privateKeyPkcs8Hex) return;
    const ts = Date.now();
    const alias = me.alias.slice(0, 64);
    const signature = await MeshoraCrypto.signData(await MeshoraCrypto.importPrivateKey(me.privateKeyPkcs8Hex), announceString(me.publicKey, alias, ts));
    const body: AnnouncePayload = { publicKey: me.publicKey, alias, timestamp: ts, signature };
    await this.sendSealed(FrameType.ANNOUNCE, utf8.encode(JSON.stringify(body)), 2, null);
  }

  // ------------------------------------------------------------------ réception

  private async onBytes(bytes: Uint8Array): Promise<void> {
    const frame = decodeFrame(bytes);
    if (!frame) return;
    const payload = this.reassembler.accept(frame);
    if (!payload) return;
    const key = idHex(frame.messageId);
    const now = Date.now();
    for (const [k, at] of this.seen) if (now - at > 6 * 3600 * 1000) this.seen.delete(k);
    if (this.seen.has(key)) return;
    this.seen.set(key, now);
    // V0.3 : seules les trames scellées par NOTRE groupe sont lues.
    if (frame.type !== FrameType.SEALED) return;
    const opened = await openSealed(getOrCreateRoom(), payload);
    if (!opened) return;
    let data: any;
    try {
      data = JSON.parse(fromUtf8.decode(opened.data));
    } catch {
      return;
    }
    try {
      if (opened.type === FrameType.ANNOUNCE) await this.onAnnounce(data as AnnouncePayload);
      else if (opened.type === FrameType.ENVELOPE) await this.onEnvelope(data as EncryptedEnvelope);
      else if (opened.type === FrameType.ACK) await this.onSignedAck(data as SignedAck);
    } catch {
      // charge utile invalide : ignorée
    }
  }

  private async onAnnounce(a: AnnouncePayload): Promise<void> {
    const me = await ensureCryptographicIdentity();
    if (!a || typeof a.publicKey !== 'string' || a.publicKey === me.publicKey) return;
    if (!/^[0-9a-f]{120,400}$/.test(a.publicKey) || typeof a.alias !== 'string' || typeof a.timestamp !== 'number') return;
    if (Math.abs(Date.now() - a.timestamp) > ANNOUNCE_MAX_AGE_MS) return;
    if (!(await MeshoraCrypto.verifySignature(a.publicKey, a.signature, announceString(a.publicKey, a.alias, a.timestamp)))) return;
    const fp = await MeshoraCrypto.computeFingerprint(a.publicKey);
    const id = 'msh_' + fp.replace(/:/g, '').substring(0, 12);
    const isNew = !this.peers.has(a.publicKey);
    this.peers.set(a.publicKey, {
      id,
      alias: `${a.alias.slice(0, 64)} (Bluetooth)`,
      publicKey: a.publicKey,
      transport: 'bluetooth',
      hops: 1,
      lastSeen: Date.now(),
      isGateway: false,
      capabilities: ['messages', 'e2ee'],
      verified: false
    } as MeshPeer & { publicKey: string });
    if (isNew) this.peersListeners.forEach((l) => { try { l(); } catch {} });
  }

  private async onEnvelope(env: EncryptedEnvelope): Promise<void> {
    const me = await ensureCryptographicIdentity();
    if (!env || env.recipientPublicKeyHex !== me.publicKey || !me.privateKeyPkcs8Hex) return;
    const dec = await MeshoraCrypto.decryptEnvelope({ envelope: env, recipientPrivateKeyPkcs8Hex: me.privateKeyPkcs8Hex });
    const senderId = 'msh_' + (await MeshoraCrypto.computeFingerprint(env.senderPublicKeyHex)).replace(/:/g, '').substring(0, 12);
    const peer = this.peers.get(env.senderPublicKeyHex);
    const msg: MeshMessage = {
      id: `${senderId}:${env.id}`,
      senderId: peer?.id || senderId,
      senderAlias: peer?.alias || 'Pair Bluetooth (clé non vérifiée)',
      recipientId: me.id,
      channelId: 'general',
      content: dec.plaintext,
      timestamp: env.timestamp,
      status: 'delivered',
      transport: 'bluetooth',
      hops: 1,
      encrypted: true,
      signature: env.signatureHex
    } as MeshMessage;
    this.messageListeners.forEach((l) => { try { l(msg); } catch {} });
    // Accusé signé v2, renvoyé par Bluetooth
    const ack = await MeshoraCrypto.createSignedAck(env, await MeshoraCrypto.importPrivateKey(me.privateKeyPkcs8Hex));
    const digest = toHex(await sha256(utf8.encode(ack.signatureHex)));
    await this.sendSealed(FrameType.ACK, utf8.encode(JSON.stringify(ack)), MAX_TTL, 'ack|' + digest);
  }

  private async onSignedAck(sa: SignedAck): Promise<void> {
    const me = await ensureCryptographicIdentity();
    const expected = this.sentTo.get(sa?.messageId);
    if (!sa || !expected || sa.senderPublicKeyHex !== me.publicKey || expected.get(sa.envelopeHash) !== sa.recipientPublicKeyHex) return;
    if (!(await MeshoraCrypto.verifySignedAck(sa))) return;
    const ack: MessageAck = {
      messageId: sa.messageId,
      recipientId: 'msh_' + (await MeshoraCrypto.computeFingerprint(sa.recipientPublicKeyHex)).replace(/:/g, '').substring(0, 12),
      recipientAlias: this.peers.get(sa.recipientPublicKeyHex)?.alias || 'Pair Bluetooth',
      timestamp: sa.timestamp,
      transport: 'bluetooth',
      verified: true
    } as MessageAck;
    this.ackListeners.forEach((l) => { try { l(ack); } catch {} });
  }
}
