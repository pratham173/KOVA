import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(__dirname, '../../firebase-applet-config.json'),
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

if (!getApps().length) {
  const projectId = resolveFirebaseProjectId();
  initializeApp(projectId ? { projectId } : undefined);
}

export const adminAuth = getAuth();
