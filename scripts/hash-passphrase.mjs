// Run locally to prepare Phase 4 Worker secrets. The plaintext passphrase is
// typed here, hidden, and never leaves this machine or touches this codebase
// — only the derived hash gets pasted into `wrangler secret put`.
//
// Usage:
//   node scripts/hash-passphrase.mjs                 → prompts for a passphrase, prints its hash
//   node scripts/hash-passphrase.mjs --token-secret   → prints a random session-token signing secret

import { hashPassphrase } from '../worker/src/auth.js';

const CTRL_C = String.fromCharCode(3);
const BACKSPACE = String.fromCharCode(8);
const DELETE = String.fromCharCode(127);

function readHidden(promptText) {
  return new Promise((resolve, reject) => {
    process.stdout.write(promptText);
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    function cleanup() {
      stdin.removeListener('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    }
    function onData(char) {
      if (char === CTRL_C) {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }
      if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === BACKSPACE || char === DELETE) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    }
    stdin.on('data', onData);
  });
}

async function main() {
  if (process.argv.includes('--token-secret')) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    console.log(Buffer.from(bytes).toString('base64'));
    console.log('\nSet this as the Worker secret: wrangler secret put AUTH_TOKEN_SECRET');
    return;
  }

  const passphrase = await readHidden('Enter the new app passphrase (input hidden): ');
  const confirm = await readHidden('Confirm passphrase: ');
  if (passphrase !== confirm) {
    console.error('Passphrases did not match.');
    process.exitCode = 1;
    return;
  }
  if (passphrase.length < 12) {
    console.error('Passphrase should be at least 12 characters.');
    process.exitCode = 1;
    return;
  }

  const hash = await hashPassphrase(passphrase);
  console.log('\nHash (paste this — never the plaintext passphrase):\n');
  console.log(hash);
  console.log('\nSet it with: wrangler secret put AUTH_PASSPHRASE_HASH');
}

main();
