import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('loads Admin Auth and resolves signing keys without require(esm) support', () => {
  const output = execFileSync(process.execPath, [
    '--no-experimental-require-module',
    '--input-type=module',
    '-e',
    `
      import { createRequire } from 'node:module';
      import { generateKeyPairSync } from 'node:crypto';
      import { strict as assert } from 'node:assert';
      await import('firebase-admin/auth');
      const require = createRequire(import.meta.url);
      const { retrieveSigningKeys } = require('jwks-rsa/src/utils.js');
      const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256' };
      const keys = await retrieveSigningKeys([jwk]);
      assert.equal(keys.length, 1);
      assert.equal(keys[0].getPublicKey(), publicKey.export({ format: 'pem', type: 'spki' }));
      console.log('ok');
    `,
  ], { encoding: 'utf8', timeout: 15000 });
  expect(output.trim()).toBe('ok');
}, 20000);
