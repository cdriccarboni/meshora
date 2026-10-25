/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Bouton d'Aide d'Urgence Officielle (112)
 */

import React, { useState } from 'react';
import { Language, i18nData } from '../core/i18n';
import { AppIdentity } from '../types';
import { Phone, ShieldAlert, X, AlertTriangle, ExternalLink } from 'lucide-react';

interface QuickSOSButtonProps {
  lang: Language;
  identity: AppIdentity;
  onAlertTriggered?: (alert: any) => void;
  onNavigateToMap?: (x: number, y: number, name: string) => void;
}

export const QuickSOSButton: React.FC<QuickSOSButtonProps> = ({
  lang,
}) => {
  const t = i18nData[lang];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Bouton Flottant d'Appel des Secours Officiels */}
      <div 
        className="fixed bottom-24 right-4 sm:right-6 z-40 flex flex-col items-end select-none pointer-events-auto"
        role="region"
        aria-label="Aide d'Urgence 112"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Appel d'urgence officiel : 112"
          className="relative w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-2xl transition-all duration-150 cursor-pointer bg-gradient-to-br from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-95 shadow-rose-950/40"
        >
          <Phone className="w-5 h-5 mb-0.5 fill-white stroke-[2.2]" />
          <span className="text-[11px] font-black tracking-tight">112</span>
        </button>
      </div>

      {/* Modal d'Aide Officielle (Consignes de sécurité réelles) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {lang === 'fr' ? 'Services de Secours Officiels' : 'Official Emergency Services'}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avertissement strict sur les limites du prototype */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p>
                {lang === 'fr'
                  ? 'MESHORA est un prototype expérimental. Il ne remplace en aucun cas les services officiels et ne garantit aucun acheminement d’alerte.'
                  : 'MESHORA is an experimental prototype. It does not replace official services and does not guarantee message delivery.'}
              </p>
            </div>

            <div className="space-y-2 text-xs text-neutral-700 dark:text-neutral-300">
              <p className="font-semibold text-neutral-900 dark:text-white">
                {lang === 'fr' ? 'En cas de danger réel, composez immédiatement :' : 'In case of real danger, immediately call:'}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="tel:112"
                  className="flex items-center justify-between p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-xs"
                >
                  <span>112 (Europe)</span>
                  <Phone className="w-4 h-4" />
                </a>
                <a
                  href="tel:15"
                  className="flex items-center justify-between p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-xs"
                >
                  <span>15 (SAMU)</span>
                  <Phone className="w-4 h-4" />
                </a>
                <a
                  href="tel:18"
                  className="flex items-center justify-between p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition shadow-xs"
                >
                  <span>18 (Pompiers)</span>
                  <Phone className="w-4 h-4" />
                </a>
                <a
                  href="sms:114"
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition shadow-xs"
                >
                  <span>114 (SMS Sourds)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition"
            >
              {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
