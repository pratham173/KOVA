import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { userSessions, users } from '../db/schema.ts';
import { getAdminEmailAllowlist } from '../db/seed.ts';
import { hashSessionToken } from '../server/paymentCrypto.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: string;
  authProvider: string;
}

export interface AuthRequest extends Request {
  dbUser?: DbUser;
  authToken?: string;
  guestCartToken?: string;
}

export async function createSessionForUser(userId: number): Promise<string> {
  const rawToken = `ksess_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  try {
    await db.insert(userSessions).values({
      userId,
      tokenHash,
      expiresAt,
    });
    return rawToken;
  } catch (error) {
    console.error('Failed to create user session:', error);
    throw new Error('Unable to create authentication session.', { cause: error });
  }
}

export async function revokeSessionToken(rawToken: string): Promise<void> {
  if (!rawToken.startsWith('ksess_')) {
    return;
  }
  const tokenHash = hashSessionToken(rawToken);
  try {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
  } catch (error) {
    console.error('Failed to revoke session token:', error);
  }
}

export async function upsertGoogleUser(
  uid: string,
  email: string,
  name: string
): Promise<DbUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = name.trim() || normalizedEmail.split('@')[0] || 'Customer';
  const adminAllowlist = getAdminEmailAllowlist();
  const shouldBeAdmin = adminAllowlist.has(normalizedEmail);

  try {
    // Check if an account already exists with this email (link smoothly)
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail[0]) {
      const targetRole = shouldBeAdmin ? 'admin' : existingByEmail[0].role;
      const [updated] = await db
        .update(users)
        .set({
          uid,
          name: displayName,
          role: targetRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();

      return {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        authProvider: updated.authProvider,
      };
    }

    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: displayName,
        role: shouldBeAdmin ? 'admin' : 'customer',
        authProvider: 'google',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          name: displayName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      id: inserted.id,
      uid: inserted.uid,
      email: inserted.email,
      name: inserted.name,
      role: inserted.role,
      authProvider: inserted.authProvider,
    };
  } catch (error) {
    console.error('Failed to upsert Google user:', error);
    throw new Error('Unable to synchronize user profile.', { cause: error });
  }
}

async function resolveUserFromToken(token: string): Promise<DbUser | null> {
  // 1. Server-issued session token (email/password login)
  if (token.startsWith('ksess_')) {
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const rows = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
        authProvider: users.authProvider,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, now)))
      .limit(1);

    return rows[0] ?? null;
  }

  // 2. Firebase ID token (Google Sign-In)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@google.local`;
    const name = decoded.name || email.split('@')[0] || 'Customer';
    return await upsertGoogleUser(decoded.uid, email, name);
  } catch {
    return null;
  }
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const guestHeader = req.headers['x-guest-cart-token'];
  if (typeof guestHeader === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(guestHeader)) {
    req.guestCartToken = guestHeader;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      req.authToken = token;
      try {
        const user = await resolveUserFromToken(token);
        if (user) {
          req.dbUser = user;
        }
      } catch (error) {
        console.error('Optional auth verification failed:', error);
      }
    }
  }

  next();
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Missing token.' });
    return;
  }

  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }
    req.dbUser = user;
    req.authToken = token;
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    res.status(401).json({ error: 'Authentication verification failed.' });
  }
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges are required for this action.' });
      return;
    }
    next();
  });
}
