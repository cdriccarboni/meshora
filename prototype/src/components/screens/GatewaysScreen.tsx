/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { GatewayNode } from '../../types';
import { ShieldManager } from '../../shield/ShieldManager';
import { Globe, ShieldCheck, AlertTriangle, Check, X, Lock } from 'lucide-react';

interface GatewaysScreenProps {
  lang: Language;
}

export const GatewaysScreen: React.FC<GatewaysScreenProps> = ({ lang }) => {
  const t = i18nData[lang];
  const shieldManager = ShieldManager.getInstance();
  const [gateways, setGateways] = useState<GatewayNode[]>(shieldManager.getGateways());
  const [consentTarget, setConsentTarget] = useState<GatewayNode | null>(null);

  const handleOpenConsent = (gw: GatewayNode) => {
    setConsentTarget(gw);
  };

  const handleResolveConsent = (grant: boolean) => {
    if (consentTarget) {
      shieldManager.grantGatewayConsent(consentTarget.id, grant);
      setGateways(shieldManager.getGateways());
      setConsentTarget(null);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-500" />
          <span>{t.gateways.title}</span>
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t.gateways.subtitle}
        </p>
      </div>

      {/* Gateway list */}
      <div className="space-y-3">
        {gateways.map((gw) => (
          <div
            key={gw.id}
            className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {gw.name}
                </span>
                {gw.countryCode && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {gw.countryCode}
                  </span>
                )}
                {gw.isTrusted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium">
                    <ShieldCheck className="w-3 h-3" /> De confiance
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Inconnue
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono">
                IP: {gw.ipAddress || 'Non assignée'} · Latence {gw.latencyMs}ms · Type: {gw.type}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {gw.requiresConsent && !gw.consentGranted ? (
                <button
                  onClick={() => handleOpenConsent(gw)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition"
                >
                  {lang === 'fr' ? 'Examiner l’autorisation' : 'Review Authorization'}
                </button>
              ) : (
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    gw.active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {gw.active ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'Autorisé' : 'Standby')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Consent Modal */}
      {consentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                {t.gateways.consentModalTitle}
              </h3>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {t.gateways.consentModalText}
            </p>

            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] space-y-1">
              <div>Nom: <strong>{consentTarget.name}</strong></div>
              <div>IP: <strong>{consentTarget.ipAddress}</strong></div>
              <div>Type: <strong>{consentTarget.type}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleResolveConsent(false)}
                className="py-2 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition"
              >
                {t.gateways.deny}
              </button>
              <button
                onClick={() => handleResolveConsent(true)}
                className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm"
              >
                {t.gateways.allowOnce}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
