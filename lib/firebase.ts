import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Prevent re-initialization crashes during Next.js Hot Module Replacement (HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export active Auth and Provider instances
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Dedicated Google Meet OAuth provider to request Meet creation scopes specifically
export const meetGoogleProvider = new GoogleAuthProvider();
meetGoogleProvider.addScope('https://www.googleapis.com/auth/meetings.space.created');
meetGoogleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Firestore with standard long-polling to bypass WebSocket restrictions within iframe sandboxes
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

// Error Handling Infrastructure matching Phase 3 mandate
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
