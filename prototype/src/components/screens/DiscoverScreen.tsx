/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';
import { Language, i18nData } from '../../core/i18n';
import { BookOpen, Radio, Globe, Shield, HeartPulse, Check, X, Smartphone, Laptop, AlertCircle } from 'lucide-react';
import { PWAInstallBanner } from '../PWAInstallBanner';

interface DiscoverScreenProps {
  lang: Language;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ lang }) => {
  const t = i18nData[lang];

  const comparisonRows = [
    {
      feature: lang === 'fr' ? 'Messagerie locale même Wi-Fi/LAN' : 'Local messaging on same Wi-Fi',
      pwa: true,
      android: true,
      ios: true
    },
    {
      feature: lang === 'fr' ? 'Stockage & File d’attente hors-ligne' : 'Offline storage & Outbox',
      pwa: true,
      android: true,
      ios: true
    },
    {
      feature: lang === 'fr' ? 'Installation instantanée sans Store' : 'Instant installation without Store',
      pwa: true,
      android: true,
      ios: true
    },
    {
      feature: lang === 'fr' ? 'Scan & Mesh Bluetooth continu en arrière-plan' : 'Continuous background Bluetooth Mesh',
      pwa: false,
      android: true,
      ios: false
    },
    {
      feature: lang === 'fr' ? 'Tunnel VPN complet au niveau OS (WireGuard)' : 'Full OS-level VPN tunnel (WireGuard)',
      pwa: false,
      android: true,
      ios: true
    },
    {
      feature: lang === 'fr' ? 'Interface Série USB directe (LoRa Meshtastic)' : 'Direct USB Serial interface (LoRa)',
      pwa: false,
      android: true,
      ios: false
    }
  ];

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <span>{t.discover.title}</span>
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t.discover.subtitle}
        </p>
      </div>

      {/* Les Quatre Modules */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {lang === 'fr' ? 'Les 4 Modules Fondamentaux' : 'The 4 Core Modules'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">MESHORA Mesh</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.mesh.description}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">MESHORA Connect</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.connect.description}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">MESHORA Shield</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.shield.description}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">MESHORA Resilience</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              {t.pillars.resilience.description}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {t.discover.tableTitle}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400">
                <th className="py-2.5 font-medium">{t.discover.tableColFeature}</th>
                <th className="py-2.5 font-medium text-center">{t.discover.tableColPwa}</th>
                <th className="py-2.5 font-medium text-center">{t.discover.tableColAndroid}</th>
                <th className="py-2.5 font-medium text-center">{t.discover.tableColIos}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="py-2.5 text-neutral-800 dark:text-neutral-200 font-medium">
                    {row.feature}
                  </td>
                  <td className="py-2.5 text-center">
                    {row.pwa ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-neutral-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    {row.android ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-neutral-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    {row.ios ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-neutral-400 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installation Guide */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {t.discover.howToInstallTitle}
        </h2>
        <div className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
          <p className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span><strong>Android (Chrome)</strong> : Touchez le menu du navigateur (3 points) puis « Installer l'application ».</span>
          </p>
          <p className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span><strong>iPhone (Safari)</strong> : {t.discover.iosGuide}</span>
          </p>
          <p className="flex items-start gap-2">
            <Laptop className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span><strong>Ordinateur (Chrome / Edge)</strong> : Cliquez sur l'icône d'installation dans la barre d'adresse.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
