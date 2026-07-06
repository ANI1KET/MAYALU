import * as crypto from 'crypto';
import { ORDER } from '../constants/index';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString().slice(-ORDER.SUFFIX_LENGTH);
  return `${ORDER.NUMBER_PREFIX}-${year}-${suffix}`;
}

export function generateSku(prefix: string): string {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix.toUpperCase().slice(0, 6)}-${rand}`;
}
