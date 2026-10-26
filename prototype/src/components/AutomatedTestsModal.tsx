/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import React, { useState, useEffect } from 'react';
import { runAutomatedTests, TestResult } from '../../tests/mesh.test';
import { Language, i18nData } from '../core/i18n';
import { CheckCircle2, XCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';

interface AutomatedTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const AutomatedTestsModal: React.FC<AutomatedTestsModalProps> = ({
  isOpen,
  onClose,
  lang
}) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const t = i18nData[lang];

  const executeTests = async () => {
    setRunning(true);
    const res = await runAutomatedTests();
    setResults(res);
    setRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPassed = results.filter((r) => r.passed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-sm text-neutral-900 dark:text-white">
              {lang === 'fr' ? 'Validation Automatisée du Prototype V.0.3' : 'Automated Prototype Validation V.0.2'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800 text-xs">
            <span className="text-neutral-500">
              {running ? (
                <span className="flex items-center gap-1.5 text-blue-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {lang === 'fr' ? 'Exécution des tests en cours...' : 'Running assertions...'}
                </span>
              ) : (
                `${totalPassed} / ${results.length} assertions validées`
              )}
            </span>
            <button
              onClick={executeTests}
              disabled={running}
              className="px-2.5 py-1 text-xs rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium"
            >
              {lang === 'fr' ? 'Re-tester' : 'Rerun'}
            </button>
          </div>

          {results.map((res, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs space-y-1 transition ${
                res.passed
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-rose-500/5 border-rose-500/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {res.name}
                </span>
                {res.passed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SUCCÈS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 font-mono">
                    <XCircle className="w-3.5 h-3.5" /> ÉCHEC
                  </span>
                )}
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                {res.details}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950/60 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition"
          >
            {t.actions.close}
          </button>
        </div>
      </div>
    </div>
  );
};
