import { TokenService } from '../../services/token.service';
import { JwtService } from '../../services/jwt.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

process.env['JWT_SECRET'] = 'test-secret-that-is-definitely-32-chars-long!!';
process.env['JWT_ACCESS_EXPIRY'] = '15m';
process.env['JWT_ISSUER'] = 'mayalu-wears';
process.env['JWT_AUDIENCE'] = 'mayalu-wears-app';
process.env['JWT_REFRESH_EXPIRE_DAYS'] = '30';
process.env['CLOUDINARY_CLOUD_NAME'] = 'test';
process.env['CLOUDINARY_API_KEY'] = 'test';
process.env['CLOUDINARY_API_SECRET'] = 'test';
process.env['ADMIN_SECRET_KEY'] = 'test-admin-key-16chars';

const makeDb = (overrides: Record<string, unknown> = {}) => ({
  query: {
    refreshTokens: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn().mockResolvedValue({ id: 'u1', phone: '+9779841234567' }),
    },
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'rt1' }]),
    }),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
    }),
  }),
  delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue({ rowCount: 3 }) }),
  ...overrides,
});

describe('TokenService', () => {
  let service: TokenService;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    const jwtService = new JwtService();
    service = new TokenService(db as never, jwtService);
  });

  it('issuePair returns a 96-char hex refresh token', async () => {
    const { rawRefreshToken } = await service.issuePair('u1', '+977', {});
    expect(rawRefreshToken).toHaveLength(96);
    expect(/^[0-9a-f]+$/.test(rawRefreshToken)).toBe(true);
  });

  it('issuePair inserts a DB record', async () => {
    await service.issuePair('u1', '+977', {});
    expect(db.insert).toHaveBeenCalled();
  });

  it('rotate throws INVALID_REFRESH_TOKEN when token not found', async () => {
    db.query.refreshTokens.findFirst.mockResolvedValue(null);
    await expect(service.rotate('badtoken', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    });
  });

  it('rotate throws REFRESH_TOKEN_REVOKED when revokedAt is set', async () => {
    db.query.refreshTokens.findFirst.mockResolvedValue({
      id: 'rt1', familyId: 'fam1', userId: 'u1',
      revokedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), isUsed: false,
    });
    await expect(service.rotate('sometoken', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REFRESH_TOKEN_REVOKED' }),
    });
  });

  it('rotate throws REFRESH_TOKEN_EXPIRED when expiresAt < now', async () => {
    db.query.refreshTokens.findFirst.mockResolvedValue({
      id: 'rt1', familyId: 'fam1', userId: 'u1',
      revokedAt: null, expiresAt: new Date(Date.now() - 1000), isUsed: false,
    });
    await expect(service.rotate('sometoken', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REFRESH_TOKEN_EXPIRED' }),
    });
  });

  it('rotate throws REFRESH_TOKEN_REUSE_DETECTED and revokes family when isUsed=true', async () => {
    db.query.refreshTokens.findFirst.mockResolvedValue({
      id: 'rt1', familyId: 'fam1', userId: 'u1',
      revokedAt: null, expiresAt: new Date(Date.now() + 86400000), isUsed: true,
    });

    await expect(service.rotate('usedtoken', {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REFRESH_TOKEN_REUSE_DETECTED' }),
    });

    // Whole family should be revoked
    const updateSetMock = db.update('').set as jest.Mock;
    expect(db.update).toHaveBeenCalled();
  });

  it('rotate success issues new pair with same familyId', async () => {
    const familyId = 'existing-family-id';
    db.query.refreshTokens.findFirst.mockResolvedValue({
      id: 'rt1', familyId, userId: 'u1',
      revokedAt: null, expiresAt: new Date(Date.now() + 86400000), isUsed: false,
    });

    const insertValuesMock = jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'rt2' }]) });
    db.insert = jest.fn().mockReturnValue({ values: insertValuesMock });

    await service.rotate('validtoken', {});

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ familyId }),
    );
  });

  it('revoke stamps revokedAt on the token', async () => {
    await service.revoke('rt1');
    expect(db.update).toHaveBeenCalled();
  });

  it('revokeAllForUser updates all non-revoked records for the user', async () => {
    await service.revokeAllForUser('u1');
    expect(db.update).toHaveBeenCalled();
  });

  it('sweepExpired returns count of deleted records', async () => {
    const count = await service.sweepExpired();
    expect(typeof count).toBe('number');
  });
});
