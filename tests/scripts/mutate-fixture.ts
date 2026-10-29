import { fixtureManager } from '../../apps/server/src/fixtures/fixtureServer.js';

const res = fixtureManager.mutateFixture('price_increase');
console.log(`✓ Fixture mutated: ${res.affectedTool} price changed from ₹${res.oldPrice} to ₹${res.newPrice}.`);
process.exit(0);
