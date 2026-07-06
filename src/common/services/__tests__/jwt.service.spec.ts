import { JwtService } from '../../services/jwt.service';
import { UnauthorizedException } from '@nestjs/common';

// Override env for tests
process.env['JWT_SECRET'] = 'test-secret-that-is-definitely-32-chars-long!!';
process.env['JWT_ACCESS_EXPIRY'] = '15m';
process.env['JWT_ISSUER'] = 'mayalu-wears';
process.env['JWT_AUDIENCE'] = 'mayalu-wears-app';
process.env['CLOUDINARY_CLOUD_NAME'] = 'test';
process.env['CLOUDINARY_API_KEY'] = 'test';
process.env['CLOUDINARY_API_SECRET'] = 'test';
process.env['ADMIN_SECRET_KEY'] = 'test-admin-key-16chars';

describe('JwtService', () => {
  let service: JwtService;

  beforeEach(() => {
    service = new JwtService();
  });

  it('should sign and verify a token (round-trip)', async () => {
    const payload = { sub: 'user-123', phone: '+9779841234567', type: 'access' as const };
    const token = await service.sign(payload);
    const verified = await service.verify(token);

    expect(verified.sub).toBe('user-123');
    expect(verified['phone']).toBe('+9779841234567');
    expect(verified['type']).toBe('access');
  });

  it('should produce a JWT with 3 dot-separated parts', async () => {
    const token = await service.sign({ sub: 'u1', phone: '+977', type: 'access' });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('should reject a tampered payload', async () => {
    const token = await service.sign({ sub: 'u1', phone: '+977', type: 'access' });
    const [header, , sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker', phone: '+0', type: 'access', exp: 9999999999 })).toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${sig}`;

    await expect(service.verify(tampered)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject a completely fake token', async () => {
    await expect(service.verify('fake.token.here')).rejects.toThrow(UnauthorizedException);
  });

  it('should reject an empty string', async () => {
    await expect(service.verify('')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ACCESS_TOKEN_EXPIRED for an expired token', async () => {
    process.env['JWT_ACCESS_EXPIRY'] = '0s';
    const expiredService = new JwtService();
    const token = await expiredService.sign({ sub: 'u1', phone: '+977', type: 'access' });

    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));

    await expect(expiredService.verify(token)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCESS_TOKEN_EXPIRED' }),
    });

    process.env['JWT_ACCESS_EXPIRY'] = '15m';
  });

  it('should throw on construction if secret is < 32 chars', () => {
    process.env['JWT_SECRET'] = 'short';
    expect(() => new JwtService()).toThrow(/JWT_SECRET must be at least 32 characters/);
    process.env['JWT_SECRET'] = 'test-secret-that-is-definitely-32-chars-long!!';
  });
});
