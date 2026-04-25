import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signAccessToken, createRefreshToken, rotateRefreshToken, revokeAllUserTokens } from './token.service';

export async function register(username: string, email: string, password: string) {
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (exists) {
    throw Object.assign(new Error('Username or email already taken'), { code: 'USER_EXISTS', status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: 'player' },
    select: { id: true, username: true, role: true },
  });

  const accessToken = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken, user };
}

export async function login(usernameOrEmail: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS', status: 401 });
  }

  const accessToken = signAccessToken({ sub: user.id, username: user.username, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } };
}

export async function refresh(rawRefreshToken: string) {
  const newRaw = await rotateRefreshToken(rawRefreshToken);
  if (!newRaw) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { code: 'INVALID_REFRESH_TOKEN', status: 401 });
  }

  // Fetch user from new token's stored userId
  // At this point, the old hash is revoked; we stored a new one.
  // We'll need another lookup — simplest: decode from new token hash lookup.
  // Alternative: return userId from rotate. Let's refactor token service.
  throw new Error('Use the rotate flow in controller — see controller comment');
}

export async function logout(userId: string) {
  await revokeAllUserTokens(userId);
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND', status: 404 });
  }
  return user;
}
