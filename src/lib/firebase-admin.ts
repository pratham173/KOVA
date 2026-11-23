import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

let cachedAuth: Auth | null = null;

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }

  let dir = process.cwd();
  try {
    dir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback to process.cwd()
  }

  const candidates = [
    path.resolve(dir, '../../firebase-applet-config.json'),
    path.resolve(dir, '../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
          projectId?: string;
        };
        if (parsed.projectId) {
          return parsed.projectId;
        }
      }
    } catch {
      // Ignore unreadable optional config file
    }
  }

  return undefined;
}

/**
 * Lazily loads and initializes Firebase Admin Auth only when verifying a
 * Google Sign-In ID token, keeping serverless cold starts fast and preventing
 * Firebase Admin initialization issues from impacting public catalogue routes.
 */
export async function getAdminAuth(): Promise<Auth> {
  if (cachedAuth) {
    return cachedAuth;
  }

  const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
  ]);

  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : undefined);
  }

  cachedAuth = getAuth();
  return cachedAuth;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const auth = await getAdminAuth();
  return auth.verifyIdToken(idToken);
}
