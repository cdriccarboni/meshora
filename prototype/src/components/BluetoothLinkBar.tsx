/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Liaison Bluetooth navigateur ↔ téléphone (Web Bluetooth). Affiche l'état réel ; aucun pair simulé.
 */
import React, { useEffect, useState } from 'react';
import { Bluetooth } from 'lucide-react';
import { TransportManager } from '../transports/TransportManager';
import { WebBluetoothTransport, BluetoothState } from '../transports/WebBluetoothTransport';

export const BluetoothLinkBar: React.FC<{ lang: 'fr' | 'en' }> = ({ lang }) => {
  const adapter = TransportManager.getInstance().getAdapter('bluetooth' as any);
  const bt = adapter instanceof WebBluetoothTransport ? adapter : null;
  const [st, setSt] = useState<{ state: BluetoothState; detail: string; peers: number }>(
    bt ? bt.getState() : { state: 'unsupported', detail: '', peers: 0 }
  );

  useEffect(() => {
    if (!bt) return;
    const refresh = () => setSt(bt.getState());
    const a = bt.onStateChange(refresh);
    const b = bt.onPeersChanged(refresh);
    const timer = setInterval(refresh, 5000);
    return () => { a(); b(); clearInterval(timer); };
  }, [bt]);

  if (!bt) return null; // navigateur sans Web Bluetooth : rien à proposer

  const linked = st.state === 'connected';
  const label = linked
    ? (lang === 'fr' ? 'Déconnecter le Bluetooth' : 'Disconnect Bluetooth')
    : (lang === 'fr' ? 'Relier un téléphone en Bluetooth' : 'Link a phone over Bluetooth');

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300">
      <span className="flex items-center gap-1.5 min-w-0">
        <Bluetooth className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {st.detail}
          {linked && ` · ${st.peers} ${lang === 'fr' ? 'pair(s) annoncé(s)' : 'announced peer(s)'}`}
        </span>
      </span>
      <button
        type="button"
        disabled={st.state === 'connecting'}
        onClick={() => (linked ? bt.disconnect() : void bt.connect())}
        className="shrink-0 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
};
