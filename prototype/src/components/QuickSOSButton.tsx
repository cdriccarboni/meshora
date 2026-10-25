/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Accès aux numéros d'urgence officiels (112).
 *
 * Contre-audit V0.2 (Claude) : bouton compact (40 px), sobre (aplat, sans halo ni animation),
 * fixé en bas à droite au-dessus de la barre de navigation ; confirmation explicite en deux temps
 * (ouvrir la fenêtre → choisir le numéro) ; fenêtre accessible (role="dialog", aria-modal,
 * Échap, piège de focus, retour du focus au bouton).
 * MESHORA n'achemine aucun appel : les liens tel: confient l'appel au téléphone de l'utilisateur.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Language } from '../core/i18n';
import { AppIdentity } from '../types';
import { Phone, X, AlertTriangle, MessageSquare } from 'lucide-react';

interface QuickSOSButtonProps {
  lang: Language;
  identity?: AppIdentity;
  onAlertTriggered?: (alert: any) => void;
  onNavigateToMap?: (x: number, y: number, name: string) => void;
}

const TXT = {
  fr: {
    open: 'Numéros d’urgence officiels (112)',
    title: 'Numéros d’urgence officiels',
    warn: 'MESHORA est un prototype. Il n’achemine aucun appel ni aucune alerte : l’appel est passé par votre téléphone, sur le réseau mobile.',
    lead: 'En cas de danger réel, appelez :',
    call112: 'Appeler le 112',
    sub112: 'Numéro d’urgence européen',
    call15: '15 · SAMU',
    call18: '18 · Pompiers',
    sms114: '114 · SMS (sourds, malentendants)',
    frOnly: 'Les numéros 15, 18 et 114 sont valables en France.',
    close: 'Fermer',
  },
  en: {
    open: 'Official emergency numbers (112)',
    title: 'Official emergency numbers',
    warn: 'MESHORA is a prototype. It does not route any call or alert: the call is placed by your phone, over the mobile network.',
    lead: 'In real danger, call:',
    call112: 'Call 112',
    sub112: 'European emergency number',
    call15: '15 · SAMU (medical)',
    call18: '18 · Fire brigade',
    sms114: '114 · Text (deaf, hard of hearing)',
    frOnly: 'Numbers 15, 18 and 114 apply in France.',
    close: 'Close',
  },
} as const;

export const QuickSOSButton: React.FC<QuickSOSButtonProps> = ({ lang }) => {
  const t = TXT[lang === 'en' ? 'en' : 'fr'];
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    // Retour du focus au déclencheur
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  return (
    <>
      {/* Bouton compact : 40 × 40 px, au-dessus de la barre de navigation (≈ 60 px + zone sûre) */}
      <button
        ref={triggerRef}
        type="button"
        data-testid="emergency-112"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t.open}
        title={t.open}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
        className="fixed right-4 sm:right-6 z-40 w-10 h-10 rounded-full inline-flex items-center justify-center bg-rose-600 text-white shadow-md hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 select-none"
      >
        <Phone className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden="true" />
        <span className="sr-only">112</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meshora-112-title"
            aria-describedby="meshora-112-warn"
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="meshora-112-title" className="text-base font-semibold text-neutral-900 dark:text-white">
                {t.title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={t.close}
                className="p-1.5 -m-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p
              id="meshora-112-warn"
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs leading-relaxed flex gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.warn}</span>
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{t.lead}</p>
              <a
                href="tel:112"
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{t.call112}</span>
                  <span className="text-[11px] opacity-90">{t.sub112}</span>
                </span>
                <Phone className="w-4 h-4" aria-hidden="true" />
              </a>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:15"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t.call15}
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a
                  href="tel:18"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t.call18}
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
              <a
                href="sms:114"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t.sms114}
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t.frOnly}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
