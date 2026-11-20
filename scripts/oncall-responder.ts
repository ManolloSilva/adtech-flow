import { readFileSync } from 'node:fs';

const alertPath = process.argv[2];
if (!alertPath) {
  console.error('Usage: tsx scripts/oncall-responder.ts <alert.json>');
  process.exit(1);
}

let alert: any;
try {
  alert = JSON.parse(readFileSync(alertPath, 'utf8'));
} catch (e) {
  console.error('Could not read alert file:', e);
  process.exit(1);
}

console.log('=== On-Call Triage ===');
console.log('Alert:', alert.alert || alert.name || 'unknown');
console.log('Severity:', alert.severity || 'unknown');
console.log('');
console.log('Suggested steps:');
console.log('1. Check backend health: curl http://localhost:8080/health');
console.log('2. Check metrics: curl http://localhost:8080/metrics');
console.log('3. Check logs: docker compose logs backend --tail=100');
console.log('4. Run tests: npm test && cd frontend && npm run test:run');
console.log('5. If DB issue: inspect volume `adtech-data` and DB_PATH.');
console.log('6. Document root cause in docs/incident-log.md.');
console.log('');
console.log('Payload:', JSON.stringify(alert, null, 2));