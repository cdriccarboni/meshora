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

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener('online', () => this.handleSystemChange());
    window.addEventListener('offline', () => this.handleSystemChange());
  }

  private static handleSystemChange(): void {
    this.notify();
  }

  public static getStatus(): NetworkStatusType {
    if (this.simulatedState !== null) {
      return this.simulatedState;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'offline';
    }

    // Default when onLine is true is 'connected'
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
