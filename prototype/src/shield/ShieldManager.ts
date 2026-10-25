/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { ShieldState, GatewayNode } from '../types';

export class ShieldManager {
  private static instance: ShieldManager | null = null;
  private state: ShieldState = {
    enabled: false,
    verifiedRealTunnel: false,
    protocol: 'wireguard',
    dnsProtection: true,
    killSwitch: false,
    nativeModuleRequired: true,
    warnings: [
      'Environnement Web : un tunnel VPN WireGuard complet au niveau du système nécessite le module natif (Android VpnService ou iOS NetworkExtension).',
      'Aucun faux état : la protection système complète reste inactive sans module natif pour éviter tout faux sentiment de sécurité.'
    ]
  };

  private trustedGateways: GatewayNode[] = [
    {
      id: 'gw_trusted_fr_01',
      name: 'Passerelle Souveraine France (FDN/Tetaneutral)',
      type: 'internet',
      ipAddress: '185.119.170.1',
      latencyMs: 18,
      isTrusted: true,
      requiresConsent: false,
      consentGranted: true,
      active: true,
      countryCode: 'FR'
    },
    {
      id: 'gw_trusted_ch_02',
      name: 'Relais Associatif Suisse (Infomaniak Community)',
      type: 'internet',
      ipAddress: '84.16.67.12',
      latencyMs: 26,
      isTrusted: true,
      requiresConsent: false,
      consentGranted: true,
      active: false,
      countryCode: 'CH'
    },
    {
      id: 'gw_unknown_peer_09',
      name: 'Passerelle Non Reconnue (Voisin mesh local)',
      type: 'mesh_bridge',
      ipAddress: '192.168.1.189',
      latencyMs: 4,
      isTrusted: false,
      requiresConsent: true,
      consentGranted: false,
      active: false
    }
  ];

  private listeners: Set<(state: ShieldState) => void> = new Set();

  public static getInstance(): ShieldManager {
    if (!this.instance) {
      this.instance = new ShieldManager();
    }
    return this.instance;
  }

  public getState(): ShieldState {
    return { ...this.state };
  }

  public getGateways(): GatewayNode[] {
    return [...this.trustedGateways];
  }

  public toggleShield(enable: boolean): void {
    // When user requests activation:
    // Strictly follow rule: verifiedRealTunnel remains FALSE in Web environment,
    // with clear warnings!
    this.state.enabled = enable;
    if (enable) {
      this.state.verifiedRealTunnel = false;
      this.state.endpoint = 'wg0.meshora.local:51820 (Simulation d’intention)';
      this.state.warnings = [
        'Protection d’isolation locale active.',
        'Module natif WireGuard non connecté : le trafic web direct n’est pas encapsulé dans un tunnel système complet.'
      ];
    } else {
      this.state.verifiedRealTunnel = false;
      this.state.endpoint = undefined;
      this.state.warnings = [
        'Protection désactivée par l’utilisateur.',
        'Toutes les communications locales continuent de fonctionner normalement sans VPN.'
      ];
    }
    this.notify();
  }

  public setKillSwitch(enable: boolean): void {
    this.state.killSwitch = enable;
    this.notify();
  }

  public setDnsProtection(enable: boolean): void {
    this.state.dnsProtection = enable;
    this.notify();
  }

  public grantGatewayConsent(gatewayId: string, grant: boolean): void {
    const gw = this.trustedGateways.find((g) => g.id === gatewayId);
    if (gw) {
      gw.consentGranted = grant;
      if (grant) {
        gw.active = true;
      } else {
        gw.active = false;
      }
    }
    this.notify();
  }

  public subscribe(listener: (state: ShieldState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.getState());
      } catch {}
    });
  }
}
