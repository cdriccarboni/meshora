/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { NetworkStatusType } from '../types';

export class NetworkSentinel {
  private static listeners: Set<(status: NetworkStatusType) => void> = new Set();
  private static simulatedState: NetworkStatusType | null = null;
  private static isInitialized = false;
  private static probeVerified = true;
  private static lastProbeTime = 0;

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleSystemChange());
      window.addEventListener('offline', () => this.handleSystemChange());
      
      // Sonde initiale
      this.probeReachability();
      // Vérification périodique toutes les 30s
      setInterval(() => this.probeReachability(), 30000);
    }
  }

  public static async probeReachability(): Promise<boolean> {
    if (typeof fetch === 'undefined') return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.probeVerified = false;
      this.notify();
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/version.json?_t=' + Date.now(), {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      this.probeVerified = res.ok;
      this.lastProbeTime = Date.now();
    } catch {
      // Portail captif ou pas d'Internet réel mais Wi-Fi connecté
      this.probeVerified = false;
    }

    this.notify();
    return this.probeVerified;
  }

  private static handleSystemChange(): void {
    this.probeReachability();
  }

  public static getStatus(): NetworkStatusType {
    if (this.simulatedState !== null) {
      return this.simulatedState;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'offline';
    }

    if (!this.probeVerified) {
      return 'local_only';
    }

    return 'connected';
  }

  public static setSimulatedState(state: NetworkStatusType | null): void {
    this.simulatedState = state;
    this.notify();
  }

  public static isSimulated(): boolean {
    return this.simulatedState !== null;
  }

  public static subscribe(listener: (status: NetworkStatusType) => void): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private static notify(): void {
    const current = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch {}
    });
  }
}
