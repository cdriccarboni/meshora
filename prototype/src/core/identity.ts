/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { AppIdentity } from '../types';

const IDENTITY_KEY = 'meshora_device_identity_v01';

function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

export function getOrCreateIdentity(): AppIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.fingerprint) {
        return parsed;
      }
    }
  } catch {
    // fallback to new identity
  }

  const id = 'msh_' + generateRandomHex(12);
  const randomAlias = DEFAULT_ALIASES[Math.floor(Math.random() * DEFAULT_ALIASES.length)] + '-' + Math.floor(100 + Math.random() * 900);
  const fingerprint = '4d53:' + generateRandomHex(4) + ':' + generateRandomHex(4) + ':' + generateRandomHex(4) + ':' + generateRandomHex(4);
  const publicKey = 'ed25519_' + generateRandomHex(32);

  const newIdentity: AppIdentity = {
    id,
    alias: randomAlias,
    fingerprint,
    publicKey,
    createdAt: Date.now()
  };

  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(newIdentity));
  } catch {
    // Ignore storage quota
  }

  return newIdentity;
}

export function updateIdentityAlias(newAlias: string): AppIdentity {
  const current = getOrCreateIdentity();
  const updated = { ...current, alias: newAlias.trim() || current.alias };
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}
