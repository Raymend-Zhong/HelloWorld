import { buffer } from '@kit.ArkTS';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';

import type { PasswordHasher } from '../domain/FamilyHabitModule';

const HASH_ROUNDS = 10000;

function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  bytes.forEach((value) => {
    result += value.toString(16).padStart(2, '0');
  });
  return result;
}

async function sha256(value: string): Promise<string> {
  const digest = cryptoFramework.createMd('SHA256');
  await digest.update({ data: new Uint8Array(buffer.from(value, 'utf-8').buffer) });
  const output = await digest.digest();
  return bytesToHex(output.data);
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
    let digest = `${salt}:${password}`;
    for (let round = 0; round < HASH_ROUNDS; round += 1) {
      digest = await sha256(digest);
    }
    return digest;
  }

  async verify(password: string, salt: string, digest: string): Promise<boolean> {
    const candidate = await this.derive(password, salt);
    return constantTimeEqual(candidate, digest);
  }
}
