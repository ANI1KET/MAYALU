import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { ARGON2_CONFIG, OTP, JWT } from '../constants/index';

export async function hashOtp(otp: string): Promise<string> {
  return argon2.hash(otp, {
    type: argon2.argon2id,
    memoryCost: ARGON2_CONFIG.memoryCost,
    timeCost: ARGON2_CONFIG.timeCost,
    parallelism: ARGON2_CONFIG.parallelism,
  });
}

export async function verifyOtp(hash: string, otp: string): Promise<boolean> {
  return argon2.verify(hash, otp);
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateOtp(): string {
  const bytes = crypto.randomBytes(OTP.RANDOM_BYTES);
  const num =
    ((bytes[0] ?? 0) * 65_536 + (bytes[1] ?? 0) * 256 + (bytes[2] ?? 0)) % OTP.MODULUS;
  return num.toString().padStart(OTP.LENGTH, '0');
}

export function generateRawRefreshToken(): string {
  return crypto.randomBytes(JWT.REFRESH_TOKEN_BYTES).toString('hex');
}
