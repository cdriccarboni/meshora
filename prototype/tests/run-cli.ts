/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — CLI Test Runner
 */

import { runAutomatedTests } from './mesh.test';

async function main() {
  console.log('====================================================');
  console.log('   MESHORA V.0.2 — EXÉCUTION DE LA SUITE DE TESTS   ');
  console.log('====================================================\n');

  const results = await runAutomatedTests();
  let failures = 0;

  results.forEach((r) => {
    const symbol = r.passed ? '✅ [SUCCÈS]' : '❌ [ÉCHEC]';
    console.log(`${symbol} ${r.name}`);
    console.log(`   └─ ${r.details}\n`);
    if (!r.passed) failures++;
  });

  console.log('----------------------------------------------------');
  console.log(`Total: ${results.length} tests | Réussis: ${results.length - failures} | Échecs: ${failures}`);
  console.log('----------------------------------------------------');

  if (failures > 0) {
    process.exit(1);
  } else {
    console.log('\nTous les invariants de MESHORA V.0.2 sont validés.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
