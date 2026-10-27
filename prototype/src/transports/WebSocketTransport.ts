/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Transport WebSocket vérifié avec chiffrement de bout en bout (E2EE) et accusés signés.
 */

import { MeshMessage, MeshPeer, MessageAck } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { getOrCreateIdentity, ensureCryptographicIdentity } from '../core/identity';
import { MeshoraCrypto, EncryptedEnvelope, SignedAck, SignedPrekey } from '../core/crypto';
import { prekeys } from '../core/prekeys';
import { isAcceptableRelayUrl } from '../core/urlHygiene';
import { DEFAULT_RELAY_URL, getOrCreateRoom, isVerifiedKey, parseInvitation, setRoom as storeRoom, upsertContact, withRoom } from '../core/invitation';

interface WebSocketPacket {
  type: 'MESHORA_MSG' | 'MESHORA_ENVELOPE' | 'MESHORA_ACK' | 'MESHORA_HELLO' | 'MESHORA_PEERS' | 'MESHORA_CHALLENGE' | 'MESHORA_PREKEY';
  /** V0.4 étape A : prékey de réception signée (HELLO, MESHORA_PREKEY, et chaque pair de MESHORA_PEERS). */
  prekey?: SignedPrekey;
  nonce?: string;
  helloSignature?: string;
  channelId?: string;
  senderId?: string;
  senderAlias?: string;
  publicKey?: string;
  message?: MeshMessage;
  envelope?: EncryptedEnvelope;
  ack?: MessageAck & { signedAck?: SignedAck };
  peers?: MeshPeer[];
  room?: string;
}

export class WebSocketTransport implements ITransportAdapter {
  public id = 'transport_lan_websocket';
  public name = 'Relais WebSocket (Internet / Passerelle)';
  public type = 'websocket' as const;

  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();
  private ackListeners: Set<(ack: MessageAck) => void> = new Set();
  private remotePeers: Map<string, MeshPeer & { publicKey?: string }> = new Map();
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: any = null;
  private targetUrl: string | null = null;
  private currentRoom = 'public_meshora';
  /** Contre-audit V0.2 : clés publiques auxquelles chaque message a réellement été chiffré (pour valider les ACK). */
  /** Pour chaque message émis : empreinte de chaque enveloppe → clé du destinataire (validation des accusés v2). */
  private sentTo: Map<string, Map<string, string>> = new Map();
  private peersChangedListeners: Set<() => void> = new Set();
  /** V0.4 étape A : prékey annoncée sur la connexion en cours (rotation sans reconnexion). */
  private announcedPrekeyId: string | null = null;
  private prekeyTimer: ReturnType<typeof setInterval> | null = null;

  /** Annonce une nouvelle prékey au relais si la rotation hebdomadaire a eu lieu pendant la connexion. */
  private async refreshPrekey(): Promise<void> {
    if (!this.isAvailable() || !this.announcedPrekeyId) return;
    try {
      const myId = await ensureCryptographicIdentity();
      if (!myId.privateKeyPkcs8Hex) return;
      const prekey = await prekeys.current(await MeshoraCrypto.importPrivateKey(myId.privateKeyPkcs8Hex), myId.publicKey);
      if (prekey.id !== this.announcedPrekeyId && this.sendRaw({ type: 'MESHORA_PREKEY', prekey })) this.announcedPrekeyId = prekey.id;
    } catch {}
  }

  public onPeersChanged(callback: () => void): () => void {
    this.peersChangedListeners.add(callback);
    return () => this.peersChangedListeners.delete(callback);
  }

  private emitPeersChanged(): void {
    this.peersChangedListeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  /** Contre-audit V0.2 : l'identifiant annoncé doit dériver de la clé publique annoncée (anti-usurpation d'identifiant). */
  private static async idMatchesKey(id: unknown, publicKeyHex: unknown): Promise<boolean> {
    if (typeof id !== 'string' || typeof publicKeyHex !== 'string' || !/^[0-9a-f]+$/i.test(publicKeyHex)) return false;
    try {
      const fp = await MeshoraCrypto.computeFingerprint(publicKeyHex);
      return id === 'msh_' + fp.replace(/:/g, '').substring(0, 12);
    } catch {
      return false;
    }
  }

  constructor(customUrl?: string) {
    this.targetUrl = this.resolveRelayUrl(customUrl);
    if (this.targetUrl) {
      this.connect();
    }
  }

  private resolveRelayUrl(customUrl?: string): string | null {
    if (customUrl) return customUrl;
    if (typeof window === 'undefined') return null;
    const fr = (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('fr'));

    // V0.3 — groupe (salon) privé propre à ce navigateur : jamais de salon public par défaut.
    this.currentRoom = getOrCreateRoom();

    // 0. Invitation reçue par lien : #join=<groupe>&k=<clé>&n=<nom>[&r=<relais>]
    try {
      const inv = parseInvitation(window.location.hash || '');
      if (inv) {
        try {
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        } catch {}
        const name = inv.alias || (fr ? 'Quelqu’un' : 'Someone');
        const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
        if (isAndroid && typeof document !== 'undefined') {
          // Ouvrir l'application exige un vrai geste de l'utilisateur (Chrome bloque la navigation automatique
          // vers meshora://) : bandeau avec deux boutons, aucune décision prise à sa place.
          this.showAndroidInviteBanner(inv, name, fr);
        } else {
          const relayNote = inv.relayUrl ? (fr ? `\n\nAttention : autre relais que celui de MESHORA (${inv.relayUrl}).` : `\n\nWarning: relay other than MESHORA's (${inv.relayUrl}).`) : '';
          const ok =
            typeof window.confirm === 'function' &&
            window.confirm(
              (fr
                ? `Invitation de ${name}.\nRejoindre son groupe ? Vous quitterez votre groupe actuel ; vos messages sont conservés.`
                : `Invitation from ${name}.\nJoin their group? You will leave your current group; your messages are kept.`) + relayNote
            );
          if (ok) {
            upsertContact(inv.publicKeyHex, inv.alias, true);
            storeRoom(inv.room);
            this.currentRoom = inv.room;
            const base = inv.relayUrl || DEFAULT_RELAY_URL;
            const url = withRoom(base, inv.room);
            try {
              localStorage.setItem('meshora_relay_url', url);
            } catch {}
            return url;
          }
        }
      }
    } catch {}

    // 1. Paramètre d'URL ?relay= et ?room= (essais)
    try {
      const params = new URLSearchParams(window.location.search);
      const qRoom = params.get('room');
      if (qRoom) {
        this.currentRoom = qRoom;
      }
      const qRelay = params.get('relay');
      if (qRelay && isAcceptableRelayUrl(qRelay)) {
        // Contre-audit V0.2 : un relais proposé par un lien n'est utilisé qu'avec l'accord explicite de l'utilisateur.
        let stored: string | null = null;
        try {
          stored = localStorage.getItem('meshora_relay_url');
        } catch {}
        if (stored === qRelay) return qRelay;
        const host = (() => {
          try {
            return new URL(qRelay).host;
          } catch {
            return qRelay;
          }
        })();
        const accepted =
          typeof window.confirm === 'function' &&
          window.confirm(
            `Ce lien propose d’utiliser le relais de test « ${host} ».\n` +
              'Le relais voit les adresses techniques et l’horaire des échanges, pas le contenu chiffré.\n' +
              'Utiliser ce relais ?'
          );
        if (accepted) {
          try {
            localStorage.setItem('meshora_relay_url', qRelay);
          } catch {}
          return qRelay;
        }
      }
    } catch {}

    // 2. Préférence enregistrée dans le navigateur
    try {
      const stored = localStorage.getItem('meshora_relay_url');
      if (stored && isAcceptableRelayUrl(stored)) {
        try {
          const r = new URL(stored).searchParams.get('room');
          if (r) this.currentRoom = r;
        } catch {}
        return stored;
      }
    } catch {}

    // 3. Relais local de développement (port 8787)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `ws://${window.location.hostname}:8787?room=${encodeURIComponent(this.currentRoom)}`;
    }

    // 4. V0.3 — relais de référence MESHORA, sans saisie
    return withRoom(DEFAULT_RELAY_URL, this.currentRoom);
  }

  /** Bandeau Android : « Ouvrir dans l'application » (lien meshora://) ou « Continuer dans le navigateur ». */
  private showAndroidInviteBanner(inv: { room: string; publicKeyHex: string; alias: string; relayUrl: string | null }, name: string, fr: boolean): void {
    const render = () => {
      const box = document.createElement('div');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', fr ? 'Invitation MESHORA' : 'MESHORA invitation');
      box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#1E293B;color:#F8FAFC;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:15px/1.4 system-ui,sans-serif';
      const p = document.createElement('p');
      p.style.margin = '0 0 12px';
      p.textContent = (fr ? 'Invitation de ' : 'Invitation from ') + name + (inv.relayUrl ? (fr ? ' (autre relais : ' : ' (other relay: ') + inv.relayUrl + ')' : '');
      const app = document.createElement('a');
      app.href = 'meshora://join#join=' + inv.room + '&k=' + inv.publicKeyHex + (inv.alias ? '&n=' + encodeURIComponent(inv.alias) : '') + (inv.relayUrl ? '&r=' + encodeURIComponent(inv.relayUrl) : '');
      app.textContent = fr ? 'Ouvrir dans l’application Android' : 'Open in the Android app';
      app.style.cssText = 'display:block;text-align:center;background:#0D9488;color:#fff;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;margin-bottom:8px';
      const web = document.createElement('button');
      web.type = 'button';
      web.textContent = fr ? 'Continuer dans le navigateur' : 'Continue in the browser';
      web.style.cssText = 'display:block;width:100%;background:transparent;color:#F8FAFC;border:1px solid #475569;padding:11px;border-radius:10px;font:inherit';
      web.onclick = () => {
        box.remove();
        this.acceptInvitation(inv);
      };
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = fr ? 'Ignorer' : 'Dismiss';
      close.style.cssText = 'display:block;width:100%;background:transparent;color:#94A3B8;border:0;padding:8px;margin-top:4px;font:inherit';
      close.onclick = () => box.remove();
      box.append(p, app, web, close);
      document.body.appendChild(box);
    };
    if (document.body) render();
    else window.addEventListener('DOMContentLoaded', render, { once: true });
  }

  /** Lien d'invitation vers MON groupe (à partager ou à montrer). */
  public getInvitationInputs(): { room: string; relayUrl: string | null } {
    let base: string | null = null;
    try {
      if (this.targetUrl) {
        const u = new URL(this.targetUrl);
        u.searchParams.delete('room');
        base = u.toString().replace(/\/$/, '').replace(/\/\?$/, '');
      }
    } catch {}
    const def = DEFAULT_RELAY_URL.replace(/\/$/, '');
    return { room: this.currentRoom, relayUrl: base && base !== def ? base : null };
  }

  public isConnected(): boolean {
    return this.connected;
  }

  /** Applique une invitation acceptée : contact vérifié, groupe et relais de l'invitant. */
  public acceptInvitation(inv: { room: string; publicKeyHex: string; alias: string; relayUrl: string | null }): void {
    upsertContact(inv.publicKeyHex, inv.alias, true);
    storeRoom(inv.room);
    this.currentRoom = inv.room;
    this.setRelayUrl(withRoom(inv.relayUrl || DEFAULT_RELAY_URL, inv.room));
  }

  /** Change de relais (adresse de base) en gardant le groupe actuel ; null = relais MESHORA par défaut. */
  public useRelayBase(base: string | null): void {
    this.setRelayUrl(withRoom(base || DEFAULT_RELAY_URL, this.currentRoom));
  }

  /** Nouveau groupe vide (les membres devront être réinvités). */
  public newGroup(room: string): void {
    storeRoom(room);
    this.currentRoom = room;
    const base = this.getInvitationInputs().relayUrl;
    this.setRelayUrl(withRoom(base || DEFAULT_RELAY_URL, room));
  }

  public setRelayUrl(url: string | null): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.connected = false;
    this.targetUrl = url;
    if (url) {
      try {
        localStorage.setItem('meshora_relay_url', url);
      } catch {}
      this.connect();
    } else {
      try {
        localStorage.removeItem('meshora_relay_url');
      } catch {}
    }
  }

  public getRelayUrl(): string | null {
    return this.targetUrl;
  }

  public getRoom(): string {
    return this.currentRoom;
  }

  public setRoom(room: string): void {
    this.currentRoom = room.trim() || 'public_meshora';
    if (this.targetUrl) {
      try {
        const u = new URL(this.targetUrl);
        u.searchParams.set('room', this.currentRoom);
        this.setRelayUrl(u.toString());
      } catch {
        this.connect();
      }
    }
  }

  private connect(): void {
    if (!this.targetUrl) {
      this.connected = false;
      return;
    }

    try {
      this.ws = new WebSocket(this.targetUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.announcedPrekeyId = null;
        if (!this.prekeyTimer && typeof setInterval === 'function') {
          this.prekeyTimer = setInterval(() => void this.refreshPrekey(), 3600_000);
        }
        // Contre-audit V0.2 : l'annonce d'identité (HELLO) est envoyée en réponse au défi du relais,
        // signée avec la clé d'identité (preuve de possession de la clé privée).
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.remotePeers.clear();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
      };

      this.ws.onmessage = async (event) => {
        try {
          const packet: WebSocketPacket = JSON.parse(event.data);
          await this.handlePacket(packet);
        } catch {}
      };
    } catch {
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.targetUrl) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 4000);
  }

  private async handlePacket(packet: WebSocketPacket): Promise<void> {
    if (!packet) return;

    switch (packet.type) {
      case 'MESHORA_CHALLENGE': {
        if (typeof packet.nonce !== 'string' || !/^[0-9a-f]{16,128}$/i.test(packet.nonce)) break;
        const myId = await ensureCryptographicIdentity();
        if (!myId.privateKeyPkcs8Hex) break;
        const privKey = await MeshoraCrypto.importPrivateKey(myId.privateKeyPkcs8Hex);
        const helloSignature = await MeshoraCrypto.signData(
          privKey,
          `MESHORA-HELLO|v1|${typeof packet.room === 'string' ? packet.room : this.currentRoom}|${packet.nonce}|${myId.publicKey}`
        );
        let prekey: SignedPrekey | undefined;
        try {
          prekey = await prekeys.current(privKey, myId.publicKey);
          this.announcedPrekeyId = prekey.id;
        } catch {}
        this.sendRaw({
          type: 'MESHORA_HELLO',
          senderId: myId.id,
          senderAlias: myId.alias,
          publicKey: myId.publicKey,
          helloSignature,
          room: this.currentRoom,
          prekey
        });
        break;
      }

      case 'MESHORA_ENVELOPE': {
        // Enveloppe chiffrée E2EE reçue
        if (packet.envelope) {
          const env = packet.envelope;
          const myId = await ensureCryptographicIdentity();

          // Vérifier si nous sommes le destinataire (ou si broadcast)
          if (env.recipientPublicKeyHex === myId.publicKey) {
            try {
              if (!myId.privateKeyPkcs8Hex) {
                return;
              }

              // Déchiffrement AES-GCM + Vérification signature de l'expéditeur
              const dec = await MeshoraCrypto.decryptEnvelope({
                envelope: env,
                recipientPrivateKeyPkcs8Hex: myId.privateKeyPkcs8Hex,
                prekeyLookup: (id) => prekeys.privateFor(id)
              });

              // Trouver l'alias de l'expéditeur dans les pairs connus
              const senderPeer = Array.from(this.remotePeers.values()).find(
                p => p.publicKey === env.senderPublicKeyHex
              );
              const derivedSenderId =
                'msh_' + (await MeshoraCrypto.computeFingerprint(env.senderPublicKeyHex)).replace(/:/g, '').substring(0, 12);

              const reconstructedMsg: MeshMessage = {
                // Identifiant local = expéditeur + identifiant : un tiers qui réutilise un identifiant
                // ne peut pas faire écarter le vrai message comme doublon (contre-audit V0.2).
                id: `${derivedSenderId}:${env.id}`,
                senderId: senderPeer?.id || derivedSenderId,
                senderAlias: senderPeer?.alias || 'Pair inconnu (clé non vérifiée)',
                recipientId: myId.id,
                channelId: 'general',
                content: dec.plaintext,
                timestamp: env.timestamp,
                status: 'delivered',
                transport: 'websocket',
                hops: 1,
                encrypted: true,
                signature: env.signatureHex
              };

              this.messageListeners.forEach((l) => {
                try {
                  l(reconstructedMsg);
                } catch {}
              });

              // Émission d'un accusé de réception signé (Signed ACK)
              const privKey = await MeshoraCrypto.importPrivateKey(myId.privateKeyPkcs8Hex);
              const signedAck = await MeshoraCrypto.createSignedAck(env, privKey);

              this.sendRaw({
                type: 'MESHORA_ACK',
                ack: {
                  messageId: env.id,
                  recipientId: myId.id,
                  recipientAlias: myId.alias,
                  timestamp: signedAck.timestamp,
                  transport: 'websocket',
                  signature: signedAck.signatureHex,
                  verified: true,
                  signedAck
                }
              });
            } catch (err) {
              console.warn('[E2EE] Échec du déchiffrement ou signature invalide:', err);
            }
          }
        }
        break;
      }

      case 'MESHORA_MSG': {
        // Contre-audit V0.2 : les messages en clair sont refusés (aucune réception, aucun ACK).
        console.warn('[MESHORA] Message en clair refusé (chiffrement de bout en bout obligatoire).');
        break;
      }

      case 'MESHORA_ACK': {
        if (packet.ack) {
          const ack = packet.ack;
          // Contre-audit V0.2 : un ACK n'est « vérifié » que s'il est signé par une clé
          // à laquelle CE message a effectivement été chiffré, et s'il porte le même identifiant.
          ack.transport = 'websocket';
          ack.verified = false;
          const sa = ack.signedAck;
          const expected = this.sentTo.get(ack.messageId);
          const me = getOrCreateIdentity();
          if (
            sa &&
            expected &&
            sa.messageId === ack.messageId &&
            sa.senderPublicKeyHex === me.publicKey &&
            expected.get(sa.envelopeHash) === sa.recipientPublicKeyHex
          ) {
            ack.verified = await MeshoraCrypto.verifySignedAck(sa);
          }
          if (!ack.verified) break;

          this.ackListeners.forEach((l) => {
            try {
              l(ack);
            } catch {}
          });
        }
        break;
      }

      case 'MESHORA_HELLO': {
        if (packet.senderId && (await WebSocketTransport.idMatchesKey(packet.senderId, packet.publicKey))) {
          if (packet.prekey && packet.publicKey) await prekeys.rememberPeer(packet.publicKey, packet.prekey);
          this.remotePeers.set(packet.senderId, {
            id: packet.senderId,
            alias: packet.senderAlias || 'Pair Distant (Relais)',
            publicKey: packet.publicKey,
            transport: 'websocket',
            hops: 1,
            rssi: -45,
            lastSeen: Date.now(),
            isGateway: false,
            capabilities: ['messages', 'files', 'e2ee'],
            // Clé cohérente avec l'identifiant, mais non vérifiée hors bande (pas encore de QR / TOFU)
            verified: false
          });
          this.emitPeersChanged();
        }
        break;
      }

      case 'MESHORA_PEERS': {
        if (Array.isArray(packet.peers)) {
          this.remotePeers.clear();
          const myId = getOrCreateIdentity();
          for (const p of packet.peers) {
            if (p && p.id !== myId.id && (await WebSocketTransport.idMatchesKey(p.id, (p as MeshPeer & { publicKey?: string }).publicKey))) {
              // Vérifié = clé reçue hors du relais (invitation) et identique à celle annoncée ici.
              const pk = (p as MeshPeer & { publicKey?: string }).publicKey || '';
              const pp = (p as MeshPeer & { prekey?: unknown }).prekey;
              if (pp && pk) await prekeys.rememberPeer(pk, pp);
              this.remotePeers.set(p.id, { ...p, verified: isVerifiedKey(pk) });
            }
          }
          this.emitPeersChanged();
        }
        break;
      }
    }
  }

  private sendRaw(data: WebSocketPacket): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  public isAvailable(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public isNativeRequired(): boolean {
    return false;
  }

  public async send(message: MeshMessage): Promise<boolean> {
    if (!this.isAvailable()) {
      return false; // Échec contrôlé : conservé dans l'Outbox locale
    }

    const myId = await ensureCryptographicIdentity();

    // Contre-audit V0.2 : chiffrement de bout en bout OBLIGATOIRE.
    // Message adressé → la clé du destinataire ; message de salon → une enveloppe par pair dont la clé est connue.
    // Aucun envoi en clair : sans clé connue, l'envoi échoue et le message reste dans l'Outbox.
    let targets: Array<MeshPeer & { publicKey?: string }>;
    if (message.recipientId && message.recipientId !== 'broadcast') {
      const p = this.remotePeers.get(message.recipientId);
      targets = p ? [p] : [];
    } else {
      targets = Array.from(this.remotePeers.values());
    }
    targets = targets.filter((p) => typeof p.publicKey === 'string' && p.publicKey.length > 0);
    if (targets.length === 0 || !myId.privateKeyPkcs8Hex) {
      return false;
    }

    let sentAny = false;
    try {
      const privKey = await MeshoraCrypto.importPrivateKey(myId.privateKeyPkcs8Hex);
      const recipients = this.sentTo.get(message.id) ?? new Map<string, string>();
      for (const peer of targets) {
        // V0.4 étape A : prékey vérifiée connue → enveloppe v3 (confidentialité persistante) ; sinon v2.
        const pk = prekeys.peer(peer.publicKey!);
        const envelope = pk
          ? await MeshoraCrypto.encryptEnvelopeV3({
              messageId: message.id,
              senderPrivateKey: privKey,
              senderPublicKeyHex: myId.publicKey,
              recipientPublicKeyHex: peer.publicKey!,
              prekey: pk,
              plaintext: message.content
            })
          : await MeshoraCrypto.encryptEnvelope({
              messageId: message.id,
              senderPrivateKey: privKey,
              senderPublicKeyHex: myId.publicKey,
              recipientPublicKeyHex: peer.publicKey!,
              plaintext: message.content
            });
        if (this.sendRaw({ type: 'MESHORA_ENVELOPE', envelope, room: this.currentRoom })) {
          recipients.set(await MeshoraCrypto.envelopeHash(envelope), peer.publicKey!);
          sentAny = true;
        }
      }
      this.sentTo.set(message.id, recipients);
      if (this.sentTo.size > 500) {
        const oldest = this.sentTo.keys().next().value;
        if (oldest) this.sentTo.delete(oldest);
      }
    } catch (err) {
      console.warn('[E2EE] Chiffrement impossible : message conservé dans l’Outbox.', err);
      return false;
    }
    return sentAny;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onAck(callback: (ack: MessageAck) => void): () => void {
    this.ackListeners.add(callback);
    return () => this.ackListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    if (!this.isAvailable()) {
      return []; // ZÉRO pair fictif : strict vérité des transports
    }
    return Array.from(this.remotePeers.values());
  }
}
