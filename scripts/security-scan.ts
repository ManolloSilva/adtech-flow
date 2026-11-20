import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

console.log('=== Dependency audit (frontend) ===');
try {
  execSync('cd frontend && npm audit --audit-level=high', { stdio: 'inherit' });
} catch (e) {
  console.warn('Frontend audit reported issues (see above).');
}

console.log('\n=== Dockerfile base image check ===');
const dockerfiles = ['frontend/Dockerfile', 'backend/Dockerfile'];
for (const f of dockerfiles) {
  const content = readFileSync(f, 'utf8');
  const fromLines = content.split('\n').filter((l) => /^FROM /i.test(l));
  for (const line of fromLines) {
    console.log(`${f}: ${line}`);
    if (/latest/i.test(line)) console.warn(`  ⚠ floating tag 'latest' in ${f}`);
    if (/:alpine$/i.test(line)) console.warn(`  ⚠ consider slim variant for ${f}`);
  }
}

console.log('\n=== Secret scan (basic) ===');
try {
  execSync("grep -RInE '(AKIA|sk_live|password\\s*=\\s*[\"'\"'\"'][^\"'\"'\"']+)' --exclude-dir=node_modules --exclude-dir=.git . || true", { stdio: 'inherit' });
} catch {}
console.log('Scan complete.');