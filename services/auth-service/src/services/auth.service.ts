import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signAccessToken, createRefreshToken, rotateRefreshToken, revokeAllUserTokens } from './token.service';

// NOTE: The auth controller handles all registration and login flows directly.
// This service layer exists as an alternative entrypoint but the `refresh` function
// below is intentionally not wired — token rotation is handled in auth.controller.ts
// using a two-step lookup that needs user data alongside the new token.

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
    select: { id: true, username: true, email: true, role: true },
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

  return { accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } };
}

// Not used in practice — see note at top of file
export async function refresh(_rawRefreshToken: string) {
  throw new Error('Use the rotate flow in auth.controller — token.service.rotateRefreshToken requires a separate user lookup');
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
