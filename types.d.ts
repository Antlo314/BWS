declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
  export const getApp: any;
}
declare module 'firebase/auth' {
  export const getAuth: any;
  export const GoogleAuthProvider: any;
  export const signInWithPopup: any;
  export const signOut: any;
  export const onAuthStateChanged: any;
  export type User = any;
}
declare module 'firebase/firestore' {
  export const getFirestore: any;
  export const initializeFirestore: any;
  export const collection: any;
  export const query: any;
  export const where: any;
  export const doc: any;
  export const setDoc: any;
  export const onSnapshot: any;
  export const getDocFromServer: any;
  export const limit: any;
  export const getDoc: any;
  export const updateDoc: any;
  export const getDocs: any;
  export const orderBy: any;
  export const deleteDoc: any;
}
declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options: any);
    models: any;
  }
}
