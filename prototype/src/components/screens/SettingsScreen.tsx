/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { AppIdentity } from '../../types';
import { updateIdentityAlias } from '../../core/identity';
import { MessageStore } from '../../core/storage';
import { Sliders, KeyRound, Database, ShieldAlert, Check, Moon, Sun, Trash2, Copy } from 'lucide-react';

interface SettingsScreenProps {
  lang: Language;
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  identity: AppIdentity;
  onIdentityUpdated: (id: AppIdentity) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  identity,
  onIdentityUpdated
}) => {
  const t = i18nData[lang];
  const [aliasInput, setAliasInput] = useState(identity.alias);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasInput.trim()) return;
    const updated = updateIdentityAlias(aliasInput);
    onIdentityUpdated(updated);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleCopyFingerprint = () => {
    navigator.clipboard?.writeText(identity.fingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const handleClearCache = () => {
    if (confirm(lang === 'fr' ? 'Effacer tous les messages et réinitialiser l’Outbox locale ?' : 'Clear all stored messages and local Outbox?')) {
      MessageStore.clearAll();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-500" />
          <span>{t.settings.title}</span>
        </h1>
      </div>

      {/* Identity Card */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-500" />
          <span>{t.settings.identityTitle}</span>
        </h2>

        <form onSubmit={handleSaveAlias} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              {t.settings.aliasLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shadow-xs"
              >
                {savedFeedback ? (lang === 'fr' ? 'Enregistré' : 'Saved') : (lang === 'fr' ? 'Modifier' : 'Update')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              {t.settings.fingerprintLabel}
            </label>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 font-mono text-xs text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
              <span className="truncate pr-2">{identity.fingerprint}</span>
              <button
                type="button"
                onClick={handleCopyFingerprint}
                className="text-neutral-500 hover:text-blue-500 p-1 rounded"
                title="Copier l'empreinte"
              >
                {copiedFingerprint ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* App Preferences (Theme & Lang) */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {lang === 'fr' ? 'Préférences d’Affichage' : 'Display Preferences'}
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {t.settings.languageLabel}
            </span>
            <button
              onClick={onToggleLang}
              className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-semibold"
            >
              {lang === 'fr' ? 'Français (FR)' : 'English (EN)'}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-3">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {t.settings.themeLabel}
            </span>
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium"
            >
              {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              <span>{theme === 'dark' ? t.settings.dark : t.settings.light}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Storage & Clear Cache */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-neutral-500" />
          <span>{t.settings.storageTitle}</span>
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {lang === 'fr'
            ? 'Toutes les données de messages et de résilience sont stockées localement sur cet appareil sans aucun transfert serveur.'
            : 'All message and resilience data is kept locally on this device without remote server transmission.'}
        </p>

        <button
          onClick={handleClearCache}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.actions.clearCache}</span>
        </button>
      </div>
    </div>
  );
};
