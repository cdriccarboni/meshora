/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Transport WebSocket vérifié avec chiffrement de bout en bout (E2EE) et accusés signés.
 */

import { MeshMessage, MeshPeer, MessageAck } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { getOrCreateIdentity, ensureCryptographicIdentity } from '../core/identity';
import { MeshoraCrypto, EncryptedEnvelope, SignedAck } from '../core/crypto';

interface WebSocketPacket {
  type: 'MESHORA_MSG' | 'MESHORA_ENVELOPE' | 'MESHORA_ACK' | 'MESHORA_HELLO' | 'MESHORA_PEERS';
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

  constructor(customUrl?: string) {
    this.targetUrl = this.resolveRelayUrl(customUrl);
    if (this.targetUrl) {
      this.connect();
    }
  }

  private resolveRelayUrl(customUrl?: string): string | null {
    if (customUrl) return customUrl;
    if (typeof window === 'undefined') return null;

    // 1. Paramètre d'URL ?relay= et ?room=
    try {
      const params = new URLSearchParams(window.location.search);
      const qRoom = params.get('room');
      if (qRoom) {
        this.currentRoom = qRoom;
      }
      const qRelay = params.get('relay');
      if (qRelay && (qRelay.startsWith('ws://') || qRelay.startsWith('wss://'))) {
        return qRelay;
      }
    } catch {}

    // 2. Préférence enregistrée dans le navigateur
    try {
      const stored = localStorage.getItem('meshora_relay_url');
      if (stored) return stored;
    } catch {}

    // 3. Relais local de développement ou démo (port 8787)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `ws://${window.location.hostname}:8787?room=${encodeURIComponent(this.currentRoom)}`;
    }

    return null;
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

      this.ws.onopen = async () => {
        this.connected = true;
        // Annonce d'identité avec vraie clé publique SPKI
        const myId = await ensureCryptographicIdentity();
        this.sendRaw({
          type: 'MESHORA_HELLO',
          senderId: myId.id,
          senderAlias: myId.alias,
          publicKey: myId.publicKey,
          room: this.currentRoom
        });
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
                recipientPrivateKeyPkcs8Hex: myId.privateKeyPkcs8Hex
              });

              // Trouver l'alias de l'expéditeur dans les pairs connus
              const senderPeer = Array.from(this.remotePeers.values()).find(
                p => p.publicKey === env.senderPublicKeyHex
              );

              const reconstructedMsg: MeshMessage = {
                id: env.id,
                senderId: senderPeer?.id || 'msh_' + env.senderPublicKeyHex.substring(0, 10),
                senderAlias: senderPeer?.alias || 'Pair E2EE Vérifié',
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
              const signedAck = await MeshoraCrypto.createSignedAck(
                env.id,
                privKey,
                myId.publicKey
              );

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
        if (packet.message) {
          const msg = packet.message;
          this.messageListeners.forEach((l) => {
            try {
              l(msg);
            } catch {}
          });

          // Accusé de réception standard
          const myId = await ensureCryptographicIdentity();
          this.sendRaw({
            type: 'MESHORA_ACK',
            ack: {
              messageId: msg.id,
              recipientId: myId.id,
              recipientAlias: myId.alias,
              timestamp: Date.now(),
              transport: 'websocket',
              verified: false
            }
          });
        }
        break;
      }

      case 'MESHORA_ACK': {
        if (packet.ack) {
          const ack = packet.ack;
          // Vérification cryptographique de l'accusé s'il contient une signature
          if (ack.signedAck) {
            const isValid = await MeshoraCrypto.verifySignedAck(ack.signedAck);
            ack.verified = isValid;
          }

          this.ackListeners.forEach((l) => {
            try {
              l(ack);
            } catch {}
          });
        }
        break;
      }

      case 'MESHORA_HELLO': {
        if (packet.senderId) {
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
            verified: !!packet.publicKey
          });
        }
        break;
      }

      case 'MESHORA_PEERS': {
        if (Array.isArray(packet.peers)) {
          this.remotePeers.clear();
          packet.peers.forEach((p) => {
            const myId = getOrCreateIdentity();
            if (p.id !== myId.id) {
              this.remotePeers.set(p.id, p);
            }
          });
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

    // Déterminer si le destinataire possède une clé publique connue pour chiffrement E2EE
    let targetPeer: (MeshPeer & { publicKey?: string }) | undefined;
    if (message.recipientId && message.recipientId !== 'broadcast') {
      targetPeer = this.remotePeers.get(message.recipientId);
    } else if (this.remotePeers.size === 1) {
      // S'il n'y a qu'un seul interlocuteur dans le salon privé, chiffrer à destination de sa clé
      targetPeer = Array.from(this.remotePeers.values())[0];
    }

    if (targetPeer && targetPeer.publicKey && myId.privateKeyPkcs8Hex) {
      try {
        const privKey = await MeshoraCrypto.importPrivateKey(myId.privateKeyPkcs8Hex);
        const envelope = await MeshoraCrypto.encryptEnvelope({
          messageId: message.id,
          senderPrivateKey: privKey,
          senderPublicKeyHex: myId.publicKey,
          recipientPublicKeyHex: targetPeer.publicKey,
          plaintext: message.content
        });

        return this.sendRaw({
          type: 'MESHORA_ENVELOPE',
          envelope,
          room: this.currentRoom
        });
      } catch (err) {
        console.warn('[E2EE] Erreur lors du chiffrement, bascule d’envoi standard:', err);
      }
    }

    // Message broadcast en clair ou salon public
    return this.sendRaw({
      type: 'MESHORA_MSG',
      message: {
        ...message,
        encrypted: false,
        transport: 'websocket'
      },
      room: this.currentRoom
    });
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
