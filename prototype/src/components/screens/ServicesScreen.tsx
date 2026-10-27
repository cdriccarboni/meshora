/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React from 'react';
import { Language, i18nData } from '../../core/i18n';
import { Layers, Radio, Globe2, ExternalLink, Clock } from 'lucide-react';

interface ServicesScreenProps {
  lang: Language;
}

export const ServicesScreen: React.FC<ServicesScreenProps> = ({ lang }) => {
  const t = i18nData[lang];

  const services = [
    {
      id: 'service_nostr',
      name: 'Nostr Relay Gateway',
      protocol: 'Nostr (NIP-01 / WSS)',
      desc: t.services.nostrDesc,
      status: t.status.inDevelopment
    },
    {
      id: 'service_bluesky',
      name: 'Bluesky AT Protocol Bridge',
      protocol: 'AT Protocol (XRPC)',
      desc: t.services.blueskyDesc,
      status: t.status.inDevelopment
    },
    {
      id: 'service_mastodon',
      name: 'ActivityPub Federation',
      protocol: 'ActivityPub (W3C Standard)',
      desc: t.services.mastodonDesc,
      status: t.status.inDevelopment
    }
  ];

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          <span>{t.services.title}</span>
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t.services.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900 dark:text-white text-sm">
                  {svc.name}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  {svc.protocol}
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300">
                {svc.desc}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{svc.status}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
