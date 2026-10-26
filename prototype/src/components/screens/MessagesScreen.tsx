/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Language, i18nData } from '../../core/i18n';
import { MeshMessage, AppIdentity, NetworkStatusType } from '../../types';
import { MessageStore } from '../../core/storage';
import { TransportManager } from '../../transports/TransportManager';
import { 
  Send, 
  Check, 
  Clock, 
  Lock, 
  Radio, 
  Users, 
  HeartPulse, 
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';

interface MessagesScreenProps {
  lang: Language;
  identity: AppIdentity;
  networkStatus: NetworkStatusType;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  lang,
  identity,
  networkStatus
}) => {
  const t = i18nData[lang];
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'general' | 'emergency'>('general');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const transportManager = TransportManager.getInstance();

  useEffect(() => {
    // Load initial
    setMessages(MessageStore.getAllMessages());

    // Subscribe to store updates
    const unsubscribeStore = MessageStore.subscribe(() => {
      setMessages(MessageStore.getAllMessages());
    });

    // Subscribe to new incoming transport messages
    const unsubscribeTransport = transportManager.onNewMessage(() => {
      setMessages(MessageStore.getAllMessages());
    });

    return () => {
      unsubscribeStore();
      unsubscribeTransport();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChannel]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: MeshMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: identity.id,
      senderAlias: identity.alias,
      recipientId: 'broadcast',
      channelId: selectedChannel,
      content: inputText.trim(),
      timestamp: Date.now(),
      status: 'queued',
      transport: 'broadcast',
      hops: 0,
      // Contre-audit V0.2 : positionné à true par TransportManager seulement si une enveloppe E2EE est partie
      encrypted: false
    };

    setInputText('');
    await transportManager.broadcast(newMessage);
  };

  const handleSendSimulatedNeighbor = () => {
    const neighborAliases = ['Relais-Sélène-88', 'Nœud-Zénith-12', 'Vigie-Atlas-99'];
    const rawAlias = neighborAliases[Math.floor(Math.random() * neighborAliases.length)];
    const alias = `[SIMULATION] ${rawAlias}`;
    const simulatedMsg: MeshMessage = {
      id: 'sim_msg_' + Date.now(),
      senderId: 'msh_neighbor_sim_' + Math.random().toString(36).substring(2, 6),
      senderAlias: alias,
      recipientId: 'broadcast',
      channelId: selectedChannel,
      content: lang === 'fr' 
        ? `[SIMULATION LOCALE] Paquet de test injecté pour démonstration d'interface.`
        : `[LOCAL SIMULATION] Test packet injected for UI demonstration.`,
      timestamp: Date.now(),
      status: 'relayed',
      transport: 'lan',
      hops: 1,
      encrypted: false
    };
    MessageStore.saveMessage(simulatedMsg);
  };

  const filteredMessages = messages
    .filter((m) => m.channelId === selectedChannel)
    .filter((m) => 
      searchQuery ? m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.senderAlias.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

  const outboxCount = messages.filter((m) => m.status === 'queued').length;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[850px] pb-16 animate-fade-in">
      {/* Top Bar Channels & Notice */}
      <div className="shrink-0 mb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Channel selector segmented buttons */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setSelectedChannel('general')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedChannel === 'general'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.messages.publicChannel}</span>
            </button>
            <button
              onClick={() => setSelectedChannel('emergency')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedChannel === 'emergency'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              <span>{t.messages.emergencyChannel}</span>
            </button>
          </div>

          {/* Simulate Neighbor button */}
          <button
            onClick={handleSendSimulatedNeighbor}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
            title="Recevoir un message d'un nœud voisin"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{lang === 'fr' ? '+ Voisin simulé' : '+ Simulated peer'}</span>
          </button>
        </div>

        {/* Tip / Notice */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[11px]">
          <span>{t.messages.testNotice}</span>
          {outboxCount > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {outboxCount} en attente
            </span>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3.5">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 text-xs py-8">
            <Radio className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-2" />
            <p>{lang === 'fr' ? 'Aucun message dans ce canal pour le moment.' : 'No messages in this channel yet.'}</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === identity.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1 px-1">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {isMe ? `${msg.senderAlias} (${lang === 'fr' ? 'Vous' : 'You'})` : msg.senderAlias}
                  </span>
                  <span>·</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>·</span>
                  <span className="capitalize">{msg.transport}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>

                {/* Status indicator for my messages */}
                {isMe && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-neutral-400 px-1">
                    {msg.status === 'queued' && (
                      <span className="flex items-center gap-1 text-amber-500" title="En attente dans la file locale">
                        <Clock className="w-3 h-3" />
                        {t.status.queued}
                      </span>
                    )}
                    {msg.status === 'sent' && (
                      <span className="flex items-center gap-1 text-sky-500" title="Transmis au transport (en attente d'accusé de réception)">
                        <Send className="w-3 h-3" />
                        {t.status.sent}
                      </span>
                    )}
                    {msg.status === 'relayed' && (
                      <span className="flex items-center gap-1 text-blue-500" title="Relayé par un nœud intermédiaire">
                        <RefreshCw className="w-3 h-3" />
                        {t.status.relayed}
                      </span>
                    )}
                    {msg.status === 'delivered' && (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium" title="Accusé de réception vérifié">
                        <Check className="w-3 h-3" />
                        {t.status.delivered}
                      </span>
                    )}
                    {msg.status === 'failed' && (
                      <span className="flex items-center gap-1 text-rose-500" title="Échec d'envoi">
                        ✕ {t.status.failed}
                      </span>
                    )}
                    {msg.encrypted && (
                      <>
                        <span className="text-neutral-500">·</span>
                        <span title={lang === 'fr' ? 'Chiffré de bout en bout (clé du pair non vérifiée hors bande)' : 'End-to-end encrypted (peer key not verified out of band)'}>
                          <Lock className="w-2.5 h-2.5 text-neutral-400" aria-label={lang === 'fr' ? 'Chiffré' : 'Encrypted'} />
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="shrink-0 mt-3 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.messages.placeholder}
            className="w-full h-11 pl-4 pr-10 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSendSimulatedNeighbor}
            className="sm:hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-500"
            title="Voisin"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="h-11 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-xs"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">{t.actions.send}</span>
        </button>
      </form>
    </div>
  );
};
