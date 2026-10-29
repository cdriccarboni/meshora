/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, ScreenId } from './components/BottomNav';
import { HomeScreen } from './components/screens/HomeScreen';
import { MessagesScreen } from './components/screens/MessagesScreen';
import { NetworkScreen } from './components/screens/NetworkScreen';
import { ShieldScreen } from './components/screens/ShieldScreen';
import { ResilienceScreen } from './components/screens/ResilienceScreen';
import { DevicesScreen } from './components/screens/DevicesScreen';
import { GatewaysScreen } from './components/screens/GatewaysScreen';
import { ServicesScreen } from './components/screens/ServicesScreen';
import { DiscoverScreen } from './components/screens/DiscoverScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { AutomatedTestsModal } from './components/AutomatedTestsModal';
import { Language } from './core/i18n';
import { getOrCreateIdentity, ensureCryptographicIdentity } from './core/identity';
import { NetworkSentinel } from './core/networkSentinel';
import { ShieldManager } from './shield/ShieldManager';
import { MessageStore } from './core/storage';
import { TransportManager } from './transports/TransportManager';
import { NetworkStatusType, ShieldState, AppIdentity } from './types';

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [identity, setIdentity] = useState<AppIdentity>(() => getOrCreateIdentity());
  const [networkStatus, setNetworkStatus] = useState<NetworkStatusType>('connected');
  const [shieldState, setShieldState] = useState<ShieldState>(() => ShieldManager.getInstance().getState());
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState(false);

  // Initialize cryptographic identity, network sentinel & services
  useEffect(() => {
    ensureCryptographicIdentity().then((realId) => {
      setIdentity(realId);
    });

    NetworkSentinel.init();
    TransportManager.getInstance();

    const unsubNetwork = NetworkSentinel.subscribe((status) => {
      setNetworkStatus(status);
    });

    const unsubShield = ShieldManager.getInstance().subscribe((state) => {
      setShieldState(state);
    });

    const updateOutbox = () => {
      setOutboxCount(MessageStore.getOutboxMessages().length);
    };
    updateOutbox();
    const unsubStore = MessageStore.subscribe(updateOutbox);

    return () => {
      unsubNetwork();
      unsubShield();
      unsubStore();
    };
  }, []);

  // Sync theme with DOM document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'fr' ? 'en' : 'fr'));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            lang={lang}
            onNavigate={(screen) => setCurrentScreen(screen)}
            networkStatus={networkStatus}
            shieldState={shieldState}
            outboxCount={outboxCount}
          />
        );
      case 'messages':
        return (
          <MessagesScreen
            lang={lang}
            identity={identity}
            networkStatus={networkStatus}
          />
        );
      case 'network':
        return (
          <NetworkScreen
            lang={lang}
            identity={identity}
          />
        );
      case 'shield':
        return (
          <ShieldScreen
            lang={lang}
            shieldState={shieldState}
          />
        );
      case 'resilience':
        return (
          <ResilienceScreen
            lang={lang}
            identity={identity}
          />
        );
      case 'devices':
        return <DevicesScreen lang={lang} />;
      case 'gateways':
        return <GatewaysScreen lang={lang} />;
      case 'services':
        return <ServicesScreen lang={lang} />;
      case 'discover':
        return <DiscoverScreen lang={lang} />;
      case 'settings':
        return (
          <SettingsScreen
            lang={lang}
            onToggleLang={toggleLanguage}
            theme={theme}
            onToggleTheme={toggleTheme}
            identity={identity}
            onIdentityUpdated={(updated) => setIdentity(updated)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* 3-Zone Header */}
      <Header
        lang={lang}
        onToggleLang={toggleLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
        networkStatus={networkStatus}
        shieldState={shieldState}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onNavigateHome={() => setCurrentScreen('home')}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-5 pb-32">
        {renderActiveScreen()}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentScreen={currentScreen}
        onSelectScreen={(screen) => setCurrentScreen(screen)}
        lang={lang}
        outboxPendingCount={outboxCount}
      />

      {/* Automated Tests Runner Modal */}
      <AutomatedTestsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}
