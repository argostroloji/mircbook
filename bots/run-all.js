/**
 * Run DevBot - The only admin bot
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                 mIRCBook Bot Runner                      ║');
console.log('║             Starting DevBot (Admin)...                   ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const proc = spawn('node', [join(__dirname, 'agents/DevBot.js')], {
    stdio: 'inherit',
    shell: true
});

proc.on('error', (err) => {
    console.error('[Runner] Error:', err);
});

proc.on('exit', (code) => {
    console.log(`[Runner] DevBot exited with code ${code}`);
    process.exit(code);
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n[Runner] Stopping DevBot...');
    proc.kill('SIGINT');
});
