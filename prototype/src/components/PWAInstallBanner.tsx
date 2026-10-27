/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../core/usePWAInstall';
import { Download, Share2, X, Smartphone, Check } from 'lucide-react';
import { Language, i18nData } from '../core/i18n';

interface PWAInstallBannerProps {
  lang: Language;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const t = i18nData[lang];

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-blue-600/20"
          title={t.actions.installGeneric}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.actions.installGeneric}</span>
        </button>
      )}

      {isIOS && !isInstallable && (
        <button
          onClick={() => setShowIOSModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-lg transition-colors whitespace-nowrap"
          title={t.actions.installIos}
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          <span>{t.actions.installIos}</span>
        </button>
      )}

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  {lang === 'fr' ? 'Installer sur iPhone / iPad' : 'Install on iPhone / iPad'}
                </h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium text-xs shrink-0 mt-0.5">1</span>
                <span>{lang === 'fr' ? 'Ouvrez ce site dans Safari.' : 'Open this website in Safari.'}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium text-xs shrink-0 mt-0.5">2</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {lang === 'fr' ? 'Touchez le bouton' : 'Tap the button'}
                  <span className="inline-flex items-center gap-1 font-medium text-neutral-900 dark:text-white px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">
                    <Share2 className="w-3.5 h-3.5 text-blue-500 inline" /> {lang === 'fr' ? 'Partager' : 'Share'}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium text-xs shrink-0 mt-0.5">3</span>
                <span>{lang === 'fr' ? 'Faites défiler et touchez « Sur l’écran d’accueil ».' : 'Scroll down and tap "Add to Home Screen".'}</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-6 w-full py-2.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              {lang === 'fr' ? 'J’ai compris' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
