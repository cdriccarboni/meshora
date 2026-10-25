/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { Home, MessageSquare, Network, Shield, HeartPulse, MoreHorizontal, Radio, Globe, Sliders, BookOpen, Layers } from 'lucide-react';
import { Language, i18nData } from '../core/i18n';

export type ScreenId = 
  | 'home'
  | 'messages'
  | 'network'
  | 'shield'
  | 'resilience'
  | 'devices'
  | 'gateways'
  | 'services'
  | 'discover'
  | 'settings';

interface BottomNavProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  lang: Language;
  unreadCount?: number;
  outboxPendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onSelectScreen,
  lang,
  unreadCount = 0,
  outboxPendingCount = 0
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const t = i18nData[lang];

  const primaryTabs: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'messages', label: t.nav.messages, icon: MessageSquare },
    { id: 'network', label: t.nav.network, icon: Network },
    { id: 'shield', label: t.nav.shield, icon: Shield },
    { id: 'resilience', label: t.nav.resilience, icon: HeartPulse }
  ];

  const secondaryTabs: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'devices', label: t.nav.devices, icon: Radio },
    { id: 'gateways', label: t.nav.gateways, icon: Globe },
    { id: 'services', label: t.nav.services, icon: Layers },
    { id: 'discover', label: t.nav.discover, icon: BookOpen },
    { id: 'settings', label: t.nav.settings, icon: Sliders }
  ];

  const isSecondaryActive = secondaryTabs.some((tab) => tab.id === currentScreen);

  return (
    <>
      {/* Secondary Drawer / More Menu Modal */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-neutral-900 border-t sm:border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl">
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {lang === 'fr' ? 'Modules et Outils MESHORA' : 'MESHORA Modules & Tools'}
              </h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1"
              >
                {t.actions.close}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentScreen === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onSelectScreen(tab.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-blue-500" />
                    <span className="text-xs font-medium truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-6 items-center h-15 px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentScreen === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setShowMoreMenu(false);
                  onSelectScreen(tab.id);
                }}
                className={`relative flex flex-col items-center justify-center h-full transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 transition-transform active:scale-95" />
                  {tab.id === 'messages' && (unreadCount > 0 || outboxPendingCount > 0) && (
                    <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full text-[9px] font-bold text-white bg-blue-600">
                      {outboxPendingCount > 0 ? outboxPendingCount : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-[50px]">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              isSecondaryActive || showMoreMenu
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 transition-transform active:scale-95" />
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[50px]">
              {t.nav.more}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
