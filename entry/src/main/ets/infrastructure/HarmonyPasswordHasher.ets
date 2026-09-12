import { cryptoFramework } from '@kit.CryptoArchitectureKit';

import type { PasswordHasher } from '../domain/FamilyHabitModule';

const KDF_ITERATIONS = 120000;

function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  bytes.forEach((value) => {
    result += value.toString(16).padStart(2, '0');
  });
  return result;
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export class HarmonyPasswordHasher implements PasswordHasher {
  async createSalt(): Promise<string> {
    const random = cryptoFramework.createRandom();
    return bytesToHex(random.generateRandomSync(16).data);
  }

  async derive(password: string, salt: string): Promise<string> {
    const spec: cryptoFramework.PBKDF2Spec = {
      algName: 'PBKDF2',
      password,
      salt: hexToBytes(salt),
      iterations: KDF_ITERATIONS,
      keySize: 32,
    };
    const kdf = cryptoFramework.createKdf('PBKDF2|SHA256');
    return bytesToHex((await kdf.generateSecret(spec)).data);
  }

  async verify(password: string, salt: string, digest: string): Promise<boolean> {
    const candidate = await this.derive(password, salt);
    return constantTimeEqual(candidate, digest);
  }
}
