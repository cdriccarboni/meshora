/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Gestion de l'Identité Cryptographique Réelle
 */

import { AppIdentity } from '../types';
import { MeshoraCrypto } from './crypto';

const IDENTITY_KEY = 'meshora_device_identity_v02';

const DEFAULT_ALIASES = [
  'Nœud-Orion',
  'Relais-Boréal',
  'Vigie-Atlas',
  'Nœud-Zénith',
  'Relais-Sélène',
  'Balise-Altaïr',
  'Nœud-Sirius',
  'Relais-Polaris'
];

let cachedIdentity: AppIdentity | null = null;
let initPromise: Promise<AppIdentity> | null = null;

export async function ensureCryptographicIdentity(): Promise<AppIdentity> {
  if (cachedIdentity && cachedIdentity.privateKeyPkcs8Hex) {
    return cachedIdentity;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(IDENTITY_KEY) : null;
      if (raw) {
        const parsed: AppIdentity = JSON.parse(raw);
        // Vérifier qu'il s'agit bien d'une vraie clé SPKI hexadécimale valide et d'une clé privée
        if (parsed.publicKey && parsed.privateKeyPkcs8Hex && !parsed.publicKey.startsWith('ed25519_')) {
          cachedIdentity = parsed;
          return parsed;
        }
      }
    } catch {
      // Régénération si corrompu
    }

    // Génération d'une paire de clés ECDSA P-256 réelle
    const keyPair = await MeshoraCrypto.generateIdentityKeyPair();
    const fingerprint = await MeshoraCrypto.computeFingerprint(keyPair.publicKeyHex);
    const randomAlias = DEFAULT_ALIASES[Math.floor(Math.random() * DEFAULT_ALIASES.length)] + '-' + Math.floor(100 + Math.random() * 900);
    const id = 'msh_' + fingerprint.replace(/:/g, '').substring(0, 12);

    const newIdentity: AppIdentity = {
      id,
      alias: randomAlias,
      fingerprint,
      publicKey: keyPair.publicKeyHex,
      privateKeyPkcs8Hex: keyPair.privateKeyPkcs8Hex,
      createdAt: Date.now()
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(newIdentity));
      }
    } catch {
      // Quota fallback
    }

    cachedIdentity = newIdentity;
    return newIdentity;
  })();

  return initPromise;
}

export function getOrCreateIdentity(): AppIdentity {
  if (cachedIdentity) {
    return cachedIdentity;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(IDENTITY_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.publicKey && parsed.privateKeyPkcs8Hex && !parsed.publicKey.startsWith('ed25519_')) {
        cachedIdentity = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback
  }

  // Déclencher l'initialisation asynchrone en arrière-plan
  ensureCryptographicIdentity();

  // Objet temporaire valide le temps que l'asynchrone termine (immédiat)
  const tempIdentity: AppIdentity = {
    id: 'msh_init_' + Math.random().toString(36).substring(2, 8),
    alias: 'Nœud-Meshora',
    fingerprint: 'En cours de génération...',
    publicKey: '',
    createdAt: Date.now()
  };
  return tempIdentity;
}

export function updateIdentityAlias(newAlias: string): AppIdentity {
  const current = getOrCreateIdentity();
  const updated = { ...current, alias: newAlias.trim() || current.alias };
  cachedIdentity = updated;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore
  }
  return updated;
}
