/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { ShieldState } from '../../types';
import { ShieldManager } from '../../shield/ShieldManager';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Lock, 
  Globe, 
  Cpu, 
  CheckCircle2, 
  Sliders,
  ExternalLink
} from 'lucide-react';

interface ShieldScreenProps {
  lang: Language;
  shieldState: ShieldState;
}

export const ShieldScreen: React.FC<ShieldScreenProps> = ({ lang, shieldState }) => {
  const t = i18nData[lang];
  const shieldManager = ShieldManager.getInstance();
  const gateways = shieldManager.getGateways();

  const handleToggleVpn = () => {
    shieldManager.toggleShield(!shieldState.enabled);
  };

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      {/* Header title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          <span>{t.shield.title}</span>
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t.shield.subtitle}
        </p>
      </div>

      {/* Main Activation Card */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t.shield.activateVpn}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {lang === 'fr'
                ? 'Active la politique de chiffrement et d’isolation des passerelles de sortie.'
                : 'Enables encryption policy and exit gateway isolation.'}
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggleVpn}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              shieldState.enabled ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                shieldState.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Protection State Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
            shieldState.enabled && shieldState.verifiedRealTunnel
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-neutral-100 dark:bg-neutral-800/70 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
          }`}
        >
          {shieldState.enabled && shieldState.verifiedRealTunnel ? (
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <span className="font-semibold block">
              {shieldState.enabled
                ? lang === 'fr'
                  ? 'Intention de protection activée (Module natif requis)'
                  : 'Protection requested (Native module required)'
                : t.status.shieldInactive}
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {shieldState.enabled
                ? lang === 'fr'
                  ? 'Dans l’environnement Web PWA, le navigateur ne dispose pas des privilèges système requis pour créer une interface réseau tun0 (WireGuard). Les échanges locaux restent chiffrés au niveau applicatif.'
                  : 'In the Web PWA environment, the browser cannot create a system tun0 interface (WireGuard). Local exchanges remain encrypted at application layer.'
                : lang === 'fr'
                  ? 'La protection est inactive. Toutes les communications locales continuent de fonctionner sans VPN.'
                  : 'Protection is inactive. Local communications continue normally without VPN.'}
            </p>
          </div>
        </div>

        {/* Truth Policy Warning (Mandatory strict rule) */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <span className="font-semibold block">{t.shield.truthWarningTitle}</span>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              {t.shield.truthWarningText}
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Gateways & Exit Nodes */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>{t.shield.trustedGateways}</span>
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono">
            {gateways.length} nœuds
          </span>
        </div>

        <div className="space-y-2">
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {gw.name}
                  </span>
                  {gw.isTrusted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-mono">
                      Vérifié
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {gw.ipAddress} · Latence {gw.latencyMs}ms
                </div>
              </div>

              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  gw.active
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                }`}
              >
                {gw.active ? 'Actif' : 'Veille'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-neutral-500" />
          <span>{lang === 'fr' ? 'Paramètres Avancés' : 'Advanced Settings'}</span>
        </h2>

        <div className="space-y-3 text-xs">
          {/* DNS Leak protection */}
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="font-medium text-neutral-900 dark:text-white block">
                {t.shield.dnsProtection}
              </span>
              <span className="text-neutral-500 text-[11px]">
                {lang === 'fr'
                  ? 'Redirige les requêtes de nom vers des résolveurs neutres.'
                  : 'Routes naming queries through neutral resolvers.'}
              </span>
            </div>
            <button
              onClick={() => shieldManager.setDnsProtection(!shieldState.dnsProtection)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                shieldState.dnsProtection ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  shieldState.dnsProtection ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Kill switch */}
          <div className="flex items-center justify-between py-1 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="font-medium text-neutral-900 dark:text-white block">
                {t.shield.killSwitch}
              </span>
              <span className="text-neutral-500 text-[11px]">
                {lang === 'fr'
                  ? 'Bloque tout le trafic sortant non maillé en cas de coupure du tunnel.'
                  : 'Blocks non-mesh outbound traffic if tunnel disconnects.'}
              </span>
            </div>
            <button
              onClick={() => shieldManager.setKillSwitch(!shieldState.killSwitch)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                shieldState.killSwitch ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  shieldState.killSwitch ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
