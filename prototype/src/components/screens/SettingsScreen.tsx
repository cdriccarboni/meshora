/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { invitationLink, parseInvitation, newRoomCode, DEFAULT_RELAY_URL } from '../../core/invitation';
import { panicWipe } from '../../core/panicWipe';

const SOURCE_URL = 'https://github.com/cdriccarboni/meshora';
const RELAY_IS_PREPROD = DEFAULT_RELAY_URL.includes('preprod');
import { isAcceptableRelayUrl } from '../../core/urlHygiene';
import React, { useState, useEffect } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { AppIdentity } from '../../types';
import { updateIdentityAlias } from '../../core/identity';
import { MessageStore } from '../../core/storage';
import { TransportManager } from '../../transports/TransportManager';
import { WebSocketTransport } from '../../transports/WebSocketTransport';
import { Sliders, KeyRound, Database, ShieldAlert, Check, Moon, Sun, Trash2, Copy, Wifi, Share2, Code2 } from 'lucide-react';

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
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Relais et invitations (V0.3)
  const wsTransport = TransportManager.getInstance().getAdapter('websocket') as WebSocketTransport | undefined;
  const inputs = wsTransport?.getInvitationInputs() || { room: '', relayUrl: null };
  const [relayBaseInput, setRelayBaseInput] = useState(inputs.relayUrl || '');
  const [relayFeedback, setRelayFeedback] = useState(false);
  const [relayError, setRelayError] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState(false);
  const inviteLink = invitationLink(
    { room: inputs.room, publicKeyHex: identity.publicKey || '', alias: identity.alias, relayUrl: inputs.relayUrl },
    (typeof window !== 'undefined' ? window.location.origin : '') + '/app/'
  );

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

  const handleSaveRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsTransport) return;
    const v = relayBaseInput.trim();
    if (v && !isAcceptableRelayUrl(v)) {
      setRelayError(true);
      return;
    }
    setRelayError(false);
    wsTransport.useRelayBase(v || null);
    setRelayFeedback(true);
    setTimeout(() => setRelayFeedback(false), 2500);
  };

  const handleCopyInviteLink = async () => {
    const text = (lang === 'fr' ? 'Rejoins-moi sur MESHORA (messagerie chiffrée, version d’essai) : ' : 'Join me on MESHORA (encrypted messaging, test version): ') + inviteLink;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
    } catch {}
    navigator.clipboard?.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleOpenInvitation = () => {
    const inv = parseInvitation(pasted);
    if (!inv || !wsTransport) {
      setPasteError(true);
      return;
    }
    const ok = confirm(
      lang === 'fr'
        ? `Rejoindre le groupe de ${inv.alias || 'cette personne'} ? Vous quitterez votre groupe actuel ; vos messages sont conservés.` + (inv.relayUrl ? `\nAttention : autre relais (${inv.relayUrl}).` : '')
        : `Join ${inv.alias || 'their'}'s group? You will leave your current group; your messages are kept.` + (inv.relayUrl ? `\nWarning: other relay (${inv.relayUrl}).` : '')
    );
    if (ok) {
      wsTransport.acceptInvitation(inv);
      setPasted('');
      setPasteError(false);
    }
  };

  const handlePanicWipe = async () => {
    const ok = confirm(
      lang === 'fr'
        ? 'EFFACEMENT D’URGENCE\n\nEffacer définitivement de cet appareil votre identité, vos messages, vos contacts et vos réglages ?\n\nIrréversible. Les messages déjà reçus par d’autres ne sont pas effacés chez eux.'
        : 'EMERGENCY WIPE\n\nPermanently erase your identity, messages, contacts and settings from this device?\n\nIrreversible. Messages already received by others are not erased on their devices.'
    );
    if (!ok) return;
    await panicWipe();
    window.location.replace(window.location.pathname);
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

      {/* Relais Internet, groupe et invitations (V0.3) */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-500" />
            <span>{lang === 'fr' ? 'Relais Internet et invitations' : 'Internet relay and invitations'}</span>
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            {wsTransport?.isConnected() ? (lang === 'fr' ? 'Connecté' : 'Connected') : (lang === 'fr' ? 'Connexion…' : 'Connecting…')}
          </span>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          {lang === 'fr'
            ? 'Connexion automatique au relais MESHORA (version d’essai' + (RELAY_IS_PREPROD ? ', préproduction' : '') + '). Le relais ne voit jamais le texte de vos messages ; il voit votre adresse IP, les horaires, la taille des messages, votre clé publique et votre nom.'
            : 'Automatic connection to the MESHORA relay (test version' + (RELAY_IS_PREPROD ? ', pre-production' : '') + '). The relay never sees the text of your messages; it sees your IP address, times, message sizes, your public key and your name.'}
        </p>
        <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
          {(lang === 'fr' ? 'Votre groupe : ' : 'Your group: ') + inputs.room}
        </p>

        <button
          type="button"
          onClick={handleCopyInviteLink}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition"
        >
          <Share2 className="w-4 h-4" />
          <span>
            {copiedInvite
              ? (lang === 'fr' ? 'Lien d’invitation copié' : 'Invitation link copied')
              : (lang === 'fr' ? 'Inviter un proche' : 'Invite someone')}
          </span>
        </button>
        <p className="text-[11px] text-neutral-500">
          {lang === 'fr'
            ? 'La personne qui ouvre le lien rejoint votre groupe ; votre clé publique devient pour elle un contact vérifié.'
            : 'Whoever opens the link joins your group; your public key becomes a verified contact for them.'}
        </p>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {lang === 'fr' ? 'J’ai reçu une invitation' : 'I received an invitation'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pasted}
              onChange={(e) => { setPasted(e.target.value); setPasteError(false); }}
              placeholder={lang === 'fr' ? 'Collez le lien d’invitation' : 'Paste the invitation link'}
              aria-invalid={pasteError}
              className="flex-1 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button type="button" onClick={handleOpenInvitation} disabled={!pasted.trim()}
              className="px-3.5 py-2 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl">
              {lang === 'fr' ? 'Ouvrir' : 'Open'}
            </button>
          </div>
          {pasteError && (
            <p role="alert" className="text-xs text-red-600">
              {lang === 'fr' ? 'Ce lien n’est pas une invitation MESHORA valide.' : 'This link is not a valid MESHORA invitation.'}
            </p>
          )}
        </div>

        <details className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <summary className="text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer">
            {lang === 'fr' ? 'Réglages avancés' : 'Advanced settings'}
          </summary>
          <form onSubmit={handleSaveRelay} className="space-y-2 mt-3">
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {lang === 'fr' ? 'Autre relais (wss://…) — laisser vide pour le relais MESHORA. Dans le navigateur, seuls les relais autorisés par le site fonctionnent ; l’application Android accepte tout relais wss://.' : 'Other relay (wss://…) — leave empty for the MESHORA relay. In the browser only relays allowed by the site work; the Android app accepts any wss:// relay.'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={relayBaseInput}
                onChange={(e) => { setRelayBaseInput(e.target.value); setRelayError(false); }}
                placeholder="wss://…"
                aria-invalid={relayError}
                className="flex-1 px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button type="submit" className="px-3.5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                {relayFeedback ? (lang === 'fr' ? 'Appliqué' : 'Applied') : (lang === 'fr' ? 'Appliquer' : 'Apply')}
              </button>
            </div>
            {relayError && (
              <p role="alert" className="text-xs text-red-600">{lang === 'fr' ? 'Adresse refusée : utilisez wss://…' : 'Address refused: use wss://…'}</p>
            )}
            <button
              type="button"
              onClick={() => {
                if (wsTransport && confirm(lang === 'fr' ? 'Créer un nouveau groupe ? Les membres actuels devront être réinvités.' : 'Create a new group? Current members will need a new invitation.')) {
                  wsTransport.newGroup(newRoomCode());
                }
              }}
              className="text-xs underline text-neutral-600 dark:text-neutral-400"
            >
              {lang === 'fr' ? 'Créer un nouveau groupe' : 'Create a new group'}
            </button>
          </form>
        </details>
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
          type="button"
          onClick={handlePanicWipe}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'Effacement d’urgence (tout effacer)' : 'Emergency wipe (erase everything)'}</span>
        </button>
        <button
          onClick={handleClearCache}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.actions.clearCache}</span>
        </button>
      </div>

      {/* À propos — accès au code source (AGPL-3.0, docs/PUBLICATION.md §3 règle 7) */}
      <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Code2 className="w-4 h-4 text-neutral-500" />
          <span>{t.settings.aboutTitle}</span>
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.settings.licenseText}</p>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition underline-offset-2 hover:underline"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t.settings.sourceLink}</span>
        </a>
      </div>
    </div>
  );
};
