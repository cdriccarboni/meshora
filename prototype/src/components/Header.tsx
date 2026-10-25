/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';
import { OrbitalLogo } from './OrbitalLogo';
import { PWAInstallBanner } from './PWAInstallBanner';
import { Language, i18nData } from '../core/i18n';
import { NetworkStatusType, ShieldState } from '../types';
import { Sun, Moon, ShieldAlert, ShieldCheck, Wifi, Radio, WifiOff, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  networkStatus: NetworkStatusType;
  shieldState: ShieldState;
  onOpenTests: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  networkStatus,
  shieldState,
  onOpenTests,
  onNavigateHome
}) => {
  const t = i18nData[lang];

  const getStatusBadge = () => {
    switch (networkStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <Wifi className="w-3 h-3" />
            <span className="hidden sm:inline">{t.status.connected}</span>
          </div>
        );
      case 'local_only':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-medium">
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">{t.status.local_only}</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-medium">
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">{t.status.offline}</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-15 flex items-center justify-between gap-4">
        {/* Zone 1: Brand & Wordmark */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 text-left group transition-opacity hover:opacity-90"
        >
          <OrbitalLogo size={28} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
              {t.brand.name}
            </span>
            <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              {t.brand.version}
            </span>
          </div>
        </button>

        {/* Zone 2: Non-jargon Status Indicator */}
        <div className="flex items-center gap-2">
          {getStatusBadge()}

          {/* Shield Status indicator */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              shieldState.enabled && shieldState.verifiedRealTunnel
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
            }`}
            title={
              shieldState.enabled && shieldState.verifiedRealTunnel
                ? t.status.shieldActive
                : t.status.shieldInactive
            }
          >
            {shieldState.enabled && shieldState.verifiedRealTunnel ? (
              <ShieldCheck className="w-3 h-3 text-blue-500" />
            ) : (
              <ShieldAlert className="w-3 h-3 text-neutral-400" />
            )}
            <span className="hidden md:inline">
              {shieldState.enabled && shieldState.verifiedRealTunnel
                ? t.status.shieldActive
                : t.status.shieldInactive}
            </span>
          </div>
        </div>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-2">
          {/* Automated tests quick-check */}
          <button
            onClick={onOpenTests}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title="Lancer les tests automatisés du prototype"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span>{t.nav.tests}</span>
          </button>

          {/* PWA Install Banner */}
          <PWAInstallBanner lang={lang} />

          {/* FR/EN Toggle */}
          <button
            onClick={onToggleLang}
            className="px-2 py-1 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title={theme === 'dark' ? t.settings.light : t.settings.dark}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
