/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Module Cryptographique Natif (WebCrypto)
 * 
 * Conforme à SECURITY.md §2-3 :
 * - Identité & Signatures : ECDSA P-256 / SHA-256
 * - Chiffrement de bout en bout (E2EE) : ECDH P-256 + AES-256-GCM
 * - Empreinte publique : SHA-256 tronquée et formatée
 * - Accusés de réception (ACK) signés
 * - Zéro secret ou texte en clair transmis au relais
 */

export interface KeyPairData {
  publicKeyHex: string;
  privateKeyPkcs8Hex: string;
}

export interface EncryptedEnvelope {
  /** Absent = v2 (clé d'identité du destinataire). 3 = prékey de réception + HKDF (V0.4 étape A). */
  v?: 3;
  /** v3 : identifiant de la prékey du destinataire utilisée. */
  prekeyId?: string;
  /** v3 : sel HKDF (32 octets aléatoires). */
  saltHex?: string;
  id: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  ephemeralPublicKeyHex: string;
  ivHex: string;
  ciphertextHex: string;
  signatureHex: string;
  timestamp: number;
}

/**
 * Accusé de réception signé, version 2 (contre-audit V0.2) : lie l'identifiant, l'expéditeur,
 * le destinataire et l'empreinte de l'enveloppe effectivement reçue.
 * Chaîne signée : ACK2|messageId|senderPublicKeyHex|recipientPublicKeyHex|envelopeHash|timestamp
 * envelopeHash = SHA-256 (hex) de la chaîne UTF-8 envelope.signatureHex.
 */
export interface SignedAck {
  messageId: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  envelopeHash: string;
  timestamp: number;
  signatureHex: string;
}

/**
 * Prékey de réception (V0.4 étape A) : clé ECDH P-256 tournante, signée par la clé d'identité.
 * Chaîne signée : PREKEY|v1|<clé d'identité>|<prékey publique>|<id>|<expiresAt>
 * id = 16 premiers caractères hex du SHA-256 de la prékey publique (SPKI).
 */
export interface SignedPrekey {
  publicKeyHex: string;
  id: string;
  expiresAt: number;
  signatureHex: string;
}

/** Une prékey annoncée n'est acceptée que si son échéance est dans cet intervalle. */
export const PREKEY_MAX_LIFETIME_MS = 30 * 24 * 3600 * 1000;

export const prekeySignedString = (identityPublicKeyHex: string, p: Pick<SignedPrekey, 'publicKeyHex' | 'id' | 'expiresAt'>) =>
  `PREKEY|v1|${identityPublicKeyHex}|${p.publicKeyHex}|${p.id}|${p.expiresAt}`;

export const envelopeSignedString = (e: EncryptedEnvelope) =>
  e.v === 3
    ? `ENV3|${e.id}|${e.senderPublicKeyHex}|${e.recipientPublicKeyHex}|${e.prekeyId}|${e.ephemeralPublicKeyHex}|${e.saltHex}|${e.ivHex}|${e.ciphertextHex}|${e.timestamp}`
    : `${e.id}|${e.senderPublicKeyHex}|${e.recipientPublicKeyHex}|${e.ephemeralPublicKeyHex}|${e.ivHex}|${e.ciphertextHex}|${e.timestamp}`;

export const envelopeHkdfInfo = (senderHex: string, recipientHex: string, prekeyId: string) =>
  `MESHORA-ENV|v3|${senderHex}|${recipientHex}|${prekeyId}`;

// Helpers hex <-> Uint8Array
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto API (crypto.subtle) non disponible dans cet environnement.');
}

export class MeshoraCrypto {
  /**
   * Génère une paire de clés d'identité ECDSA P-256
   */
  public static async generateIdentityKeyPair(): Promise<{
    publicKeyHex: string;
    privateKeyPkcs8Hex: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }> {
    const subtle = getSubtle();
    const keyPair = await subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    const spki = await subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKeyHex: bytesToHex(new Uint8Array(spki)),
      privateKeyPkcs8Hex: bytesToHex(new Uint8Array(pkcs8)),
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Importe une clé publique ECDSA depuis de l'hexadécimal
   */
  public static async importPublicKey(publicKeyHex: string): Promise<CryptoKey> {
    const subtle = getSubtle();
    const bytes = hexToBytes(publicKeyHex);
    return subtle.importKey(
      'spki',
      bytes as unknown as BufferSource,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['verify']
    );
  }

  /**
   * Importe une clé privée ECDSA depuis de l'hexadécimal
   */
  public static async importPrivateKey(privateKeyPkcs8Hex: string): Promise<CryptoKey> {
    const subtle = getSubtle();
    const bytes = hexToBytes(privateKeyPkcs8Hex);
    return subtle.importKey(
      'pkcs8',
      bytes as unknown as BufferSource,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign']
    );
  }

  /**
   * Calcule l'empreinte vérifiable (SHA-256) d'une clé publique
   */
  public static async computeFingerprint(publicKeyHex: string): Promise<string> {
    const subtle = getSubtle();
    const bytes = hexToBytes(publicKeyHex);
    const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hex = bytesToHex(new Uint8Array(digest));
    // Découpage en blocs de 4 caractères pour lisibilité humaine
    return hex.substring(0, 32).match(/.{1,4}/g)?.join(':') || hex.substring(0, 32);
  }

  /**
   * Signe un contenu texte ou binaire avec une clé privée ECDSA
   */
  public static async signData(privateKey: CryptoKey, data: string | Uint8Array): Promise<string> {
    const subtle = getSubtle();
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const signature = await subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      bytes as unknown as BufferSource
    );
    return bytesToHex(new Uint8Array(signature));
  }

  /**
   * Vérifie la signature ECDSA d'un contenu
   */
  public static async verifySignature(
    publicKeyHex: string,
    signatureHex: string,
    data: string | Uint8Array
  ): Promise<boolean> {
    try {
      const subtle = getSubtle();
      const publicKey = await this.importPublicKey(publicKeyHex);
      const signatureBytes = hexToBytes(signatureHex);
      const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

      return await subtle.verify(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' }
        },
        publicKey,
        signatureBytes as unknown as BufferSource,
        dataBytes as unknown as BufferSource
      );
    } catch {
      return false;
    }
  }

  /**
   * Chiffre un message de bout en bout (E2EE) à destination d'une clé publique.
   * Utilise ECDH éphémère (P-256) + AES-256-GCM + Signature de l'expéditeur.
   */
  public static async encryptEnvelope(params: {
    messageId: string;
    senderPrivateKey: CryptoKey;
    senderPublicKeyHex: string;
    recipientPublicKeyHex: string;
    plaintext: string;
  }): Promise<EncryptedEnvelope> {
    const subtle = getSubtle();

    // 1. Génération paire ECDH éphémère
    const ephemeralKeyPair = await subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey']
    );

    // 2. Importation de la clé ECDH publique du destinataire
    // Comme la clé destinataire est stockée au format SPKI P-256, on l'importe en ECDH
    const recipientBytes = hexToBytes(params.recipientPublicKeyHex);
    const recipientEcdhKey = await subtle.importKey(
      'spki',
      recipientBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // 3. Dérivation de la clé symétrique AES-256-GCM
    const aesKey = await subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientEcdhKey
      },
      ephemeralKeyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt']
    );

    // 4. Chiffrement AES-GCM
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(params.plaintext);
    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      plaintextBytes
    );

    const ephemeralSpki = await subtle.exportKey('spki', ephemeralKeyPair.publicKey);
    const ephemeralPublicKeyHex = bytesToHex(new Uint8Array(ephemeralSpki));
    const ivHex = bytesToHex(iv);
    const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBuffer));
    const timestamp = Date.now();

    // 5. Signature de l'enveloppe par l'expéditeur
    const unsigned: EncryptedEnvelope = {
      id: params.messageId,
      senderPublicKeyHex: params.senderPublicKeyHex,
      recipientPublicKeyHex: params.recipientPublicKeyHex,
      ephemeralPublicKeyHex,
      ivHex,
      ciphertextHex,
      signatureHex: '',
      timestamp
    };
    unsigned.signatureHex = await this.signData(params.senderPrivateKey, envelopeSignedString(unsigned));
    return unsigned;
  }

  // ------------------------------------------------------------------ V0.4 étape A : prékeys et enveloppe v3

  /** Identifiant d'une prékey : 16 premiers caractères hex du SHA-256 de sa clé publique SPKI. */
  public static async prekeyId(prekeyPublicKeyHex: string): Promise<string> {
    const d = await getSubtle().digest('SHA-256', hexToBytes(prekeyPublicKeyHex) as unknown as BufferSource);
    return bytesToHex(new Uint8Array(d)).substring(0, 16);
  }

  /** Crée une prékey ECDH P-256 signée par la clé d'identité. Renvoie aussi sa clé privée (PKCS#8 hex). */
  public static async generatePrekey(
    identityPrivateKey: CryptoKey,
    identityPublicKeyHex: string,
    expiresAt: number
  ): Promise<{ prekey: SignedPrekey; privateKeyPkcs8Hex: string }> {
    const subtle = getSubtle();
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const publicKeyHex = bytesToHex(new Uint8Array(await subtle.exportKey('spki', kp.publicKey)));
    const privateKeyPkcs8Hex = bytesToHex(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey)));
    const id = await this.prekeyId(publicKeyHex);
    const signatureHex = await this.signData(identityPrivateKey, prekeySignedString(identityPublicKeyHex, { publicKeyHex, id, expiresAt }));
    return { prekey: { publicKeyHex, id, expiresAt, signatureHex }, privateKeyPkcs8Hex };
  }

  /**
   * Vérifie une prékey annoncée pour une identité : forme, identifiant = empreinte, signature de l'identité,
   * échéance future et raisonnable. Une prékey refusée n'est jamais utilisée (repli sur v2).
   */
  public static async verifyPrekey(identityPublicKeyHex: string, p: unknown, now = Date.now()): Promise<boolean> {
    const k = p as SignedPrekey;
    if (!k || typeof k !== 'object') return false;
    if (typeof k.publicKeyHex !== 'string' || !/^[0-9a-f]{2,400}$/i.test(k.publicKeyHex)) return false;
    if (typeof k.id !== 'string' || !/^[0-9a-f]{16}$/.test(k.id)) return false;
    if (typeof k.signatureHex !== 'string' || !/^[0-9a-f]{128}$/i.test(k.signatureHex)) return false;
    if (!Number.isFinite(k.expiresAt) || k.expiresAt <= now || k.expiresAt > now + PREKEY_MAX_LIFETIME_MS) return false;
    if (k.publicKeyHex === identityPublicKeyHex) return false;
    try {
      if ((await this.prekeyId(k.publicKeyHex)) !== k.id) return false;
      await getSubtle().importKey('spki', hexToBytes(k.publicKeyHex) as unknown as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    } catch {
      return false;
    }
    return this.verifySignature(identityPublicKeyHex, k.signatureHex, prekeySignedString(identityPublicKeyHex, k));
  }

  /** Clé AES-256-GCM d'une enveloppe v3 : HKDF-SHA256(ECDH(privée, publique), sel, info). */
  private static async v3Key(privateKeyPkcs8Hex: string, publicKeyHex: string, saltHex: string, info: string, usage: KeyUsage): Promise<CryptoKey> {
    const subtle = getSubtle();
    const priv = await subtle.importKey('pkcs8', hexToBytes(privateKeyPkcs8Hex) as unknown as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const pub = await subtle.importKey('spki', hexToBytes(publicKeyHex) as unknown as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
    const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: hexToBytes(saltHex) as unknown as BufferSource, info: new TextEncoder().encode(info) as unknown as BufferSource },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      [usage]
    );
  }

  /** Exposé pour les vecteurs de test : clé de message brute v3. */
  public static async v3MessageKeyHex(privateKeyPkcs8Hex: string, publicKeyHex: string, saltHex: string, info: string): Promise<string> {
    const subtle = getSubtle();
    const priv = await subtle.importKey('pkcs8', hexToBytes(privateKeyPkcs8Hex) as unknown as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const pub = await subtle.importKey('spki', hexToBytes(publicKeyHex) as unknown as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
    const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: hexToBytes(saltHex) as unknown as BufferSource, info: new TextEncoder().encode(info) as unknown as BufferSource },
      ikm,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }

  /**
   * Enveloppe v3 : ECDH(éphémère, prékey du destinataire) → HKDF-SHA256 → AES-256-GCM.
   * L'appelant DOIT avoir vérifié la prékey (verifyPrekey) pour cette identité de destinataire.
   */
  public static async encryptEnvelopeV3(params: {
    messageId: string;
    senderPrivateKey: CryptoKey;
    senderPublicKeyHex: string;
    recipientPublicKeyHex: string;
    prekey: SignedPrekey;
    plaintext: string;
  }): Promise<EncryptedEnvelope> {
    const subtle = getSubtle();
    const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const ephPub = bytesToHex(new Uint8Array(await subtle.exportKey('spki', eph.publicKey)));
    const ephPriv = bytesToHex(new Uint8Array(await subtle.exportKey('pkcs8', eph.privateKey)));
    const saltHex = bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.v3Key(ephPriv, params.prekey.publicKeyHex, saltHex, envelopeHkdfInfo(params.senderPublicKeyHex, params.recipientPublicKeyHex, params.prekey.id), 'encrypt');
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(params.plaintext));
    const env: EncryptedEnvelope = {
      v: 3,
      id: params.messageId,
      senderPublicKeyHex: params.senderPublicKeyHex,
      recipientPublicKeyHex: params.recipientPublicKeyHex,
      prekeyId: params.prekey.id,
      ephemeralPublicKeyHex: ephPub,
      saltHex,
      ivHex: bytesToHex(iv),
      ciphertextHex: bytesToHex(new Uint8Array(ct)),
      signatureHex: '',
      timestamp: Date.now()
    };
    env.signatureHex = await this.signData(params.senderPrivateKey, envelopeSignedString(env));
    return env;
  }

  /**
   * Déchiffre une enveloppe E2EE avec la clé privée du destinataire
   */
  public static async decryptEnvelope(params: {
    envelope: EncryptedEnvelope;
    recipientPrivateKeyPkcs8Hex: string;
    /** v3 : renvoie la clé privée (PKCS#8 hex) de la prékey désignée, ou null si elle a été effacée. */
    prekeyLookup?: (prekeyId: string) => string | null | Promise<string | null>;
  }): Promise<{
    plaintext: string;
    verifiedSender: boolean;
  }> {
    const subtle = getSubtle();
    const env = params.envelope;

    // 1. Vérification de la signature de l'expéditeur
    if (env.v !== undefined && env.v !== 3) throw new Error('Version d’enveloppe inconnue.');
    const payloadSigned = envelopeSignedString(env);
    const verifiedSender = await this.verifySignature(
      env.senderPublicKeyHex,
      env.signatureHex,
      payloadSigned
    );

    if (!verifiedSender) {
      throw new Error('ÉCHEC DE SÉCURITÉ : Signature de l’expéditeur invalide ou message altéré.');
    }

    if (env.v === 3) {
      if (typeof env.prekeyId !== 'string' || typeof env.saltHex !== 'string' || !/^[0-9a-f]{64}$/i.test(env.saltHex)) {
        throw new Error('Enveloppe v3 mal formée.');
      }
      const prekeyPriv = params.prekeyLookup ? await params.prekeyLookup(env.prekeyId) : null;
      if (!prekeyPriv) throw new Error('Prékey inconnue ou effacée : message illisible (confidentialité persistante).');
      const key = await this.v3Key(prekeyPriv, env.ephemeralPublicKeyHex, env.saltHex, envelopeHkdfInfo(env.senderPublicKeyHex, env.recipientPublicKeyHex, env.prekeyId), 'decrypt');
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(env.ivHex) as unknown as BufferSource }, key, hexToBytes(env.ciphertextHex) as unknown as BufferSource);
      return { plaintext: new TextDecoder().decode(pt), verifiedSender: true };
    }

    // 2. Importation de la clé privée destinataire en mode ECDH
    const recipientBytes = hexToBytes(params.recipientPrivateKeyPkcs8Hex);
    const recipientEcdhPrivateKey = await subtle.importKey(
      'pkcs8',
      recipientBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey']
    );

    // 3. Importation de la clé éphémère de l'enveloppe
    const ephemeralBytes = hexToBytes(env.ephemeralPublicKeyHex);
    const ephemeralKey = await subtle.importKey(
      'spki',
      ephemeralBytes as unknown as BufferSource,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // 4. Dérivation de la même clé AES-GCM
    const aesKey = await subtle.deriveKey(
      {
        name: 'ECDH',
        public: ephemeralKey
      },
      recipientEcdhPrivateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    );

    // 5. Déchiffrement AES-GCM
    const iv = hexToBytes(env.ivHex);
    const ciphertext = hexToBytes(env.ciphertextHex);

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource
      },
      aesKey,
      ciphertext as unknown as BufferSource
    );

    const plaintext = new TextDecoder().decode(decryptedBuffer);

    return {
      plaintext,
      verifiedSender: true
    };
  }

  /** Empreinte d'une enveloppe (SHA-256 hex de sa signature, qui couvre tous ses champs). */
  public static async envelopeHash(envelope: EncryptedEnvelope): Promise<string> {
    const digest = await getSubtle().digest('SHA-256', new TextEncoder().encode(envelope.signatureHex) as unknown as BufferSource);
    return bytesToHex(new Uint8Array(digest));
  }

  /** Crée l'accusé signé (v2) d'une enveloppe reçue et déchiffrée. */
  public static async createSignedAck(envelope: EncryptedEnvelope, recipientPrivateKey: CryptoKey): Promise<SignedAck> {
    const timestamp = Date.now();
    const envelopeHash = await this.envelopeHash(envelope);
    const payload = `ACK2|${envelope.id}|${envelope.senderPublicKeyHex}|${envelope.recipientPublicKeyHex}|${envelopeHash}|${timestamp}`;
    const signatureHex = await this.signData(recipientPrivateKey, payload);
    return {
      messageId: envelope.id,
      senderPublicKeyHex: envelope.senderPublicKeyHex,
      recipientPublicKeyHex: envelope.recipientPublicKeyHex,
      envelopeHash,
      timestamp,
      signatureHex
    };
  }

  /** Vérifie la signature d'un accusé v2 (le contrôle de correspondance avec l'envoi reste à l'appelant). */
  public static async verifySignedAck(ack: SignedAck): Promise<boolean> {
    if (!ack || typeof ack.senderPublicKeyHex !== 'string' || typeof ack.envelopeHash !== 'string') return false;
    const payload = `ACK2|${ack.messageId}|${ack.senderPublicKeyHex}|${ack.recipientPublicKeyHex}|${ack.envelopeHash}|${ack.timestamp}`;
    return this.verifySignature(ack.recipientPublicKeyHex, ack.signatureHex, payload);
  }
}
