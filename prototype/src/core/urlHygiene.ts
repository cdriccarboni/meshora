/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Hygiène des adresses (contre-audit V0.2).
 *
 * - Retire de l'adresse affichée les paramètres de suivi marketing (utm_*, identifiants de clic publicitaires).
 * - Conserve tous les paramètres fonctionnels (relay, room, invitation, appairage, navigation…) et le fragment (#…).
 * - MESHORA ne génère jamais de paramètres de suivi dans ses propres liens.
 */

const TRACKING_EXACT = new Set(['fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'yclid', 'twclid', 'ttclid', 'li_fat_id']);

export function isTrackingParam(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('utm_') || TRACKING_EXACT.has(n);
}

/** Retourne l'URL nettoyée, ou null si aucun paramètre de suivi n'était présent. */
export function stripTrackingParams(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const keys = Array.from(new Set(Array.from(url.searchParams.keys())));
  const tracking = keys.filter(isTrackingParam);
  if (tracking.length === 0) return null;
  tracking.forEach((k) => url.searchParams.delete(k));
  return url.toString().replace(/\?(?=#|$)/, '');
}

/** Applique le nettoyage à la barre d'adresse sans recharger la page ni créer d'entrée d'historique. */
export function cleanAddressBar(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const cleaned = stripTrackingParams(window.location.href);
  if (cleaned) {
    try {
      window.history.replaceState(window.history.state, '', cleaned);
    } catch {}
  }
}

/** Relais autorisés : wss:// partout ; ws:// seulement en local ou sur réseau privé (tests). */
export function isAcceptableRelayUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  if (u.protocol === 'wss:') return true;
  if (u.protocol !== 'ws:') return false;
  const h = u.hostname.replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local') ||
    /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}
