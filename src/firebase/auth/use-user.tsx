
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useToast } from '@/components/ui/use-toast';

interface UserProfile {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    lastLogin: any;
    role: 'super_admin' | 'admin' | 'school_head' | 'school_admin' | 'viewer';
    schoolId?: string;
}

interface UserState {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  isSchoolHead: boolean;
  isUserLoading: boolean;
  error: Error | null;
}

function getGoogleSignInErrorMessage(error: unknown) {
  const authError = error as { code?: string; message?: string };

  switch (authError.code) {
    case 'auth/unauthorized-domain':
      return 'This Vercel domain is not authorized in Firebase Authentication. Add it under Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in popup was closed before sign-in completed.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another Google sign-in popup was already open. Close extra popups and try again.';
    case 'auth/network-request-failed':
      return 'Network connection failed while contacting Google. Check your connection and try again.';
    default:
      return authError.message || 'Could not sign in with Google. Please try again.';
  }
}

export const useUser = () => {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const [userState, setUserState] = useState<UserState>({
    user: null,
    profile: null,
    isAdmin: false,
    isSuperAdmin: false,
    isSchoolAdmin: false,
    isSchoolHead: false,
    isUserLoading: true,
    error: null,
  });

  const handleUser = useCallback(async (user: User | null) => {
    if (user) {
        const userRef = doc(firestore, 'users', user.uid);
        
        try {
            const isSuperByEmail = user.email?.toLowerCase() === 'jerniqz@gmail.com';
            
            let userProfile: UserProfile | null = null;
            const userDoc = await getDoc(userRef);

            if (isSuperByEmail) {
                const superAdminData: UserProfile = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email?.toLowerCase() || null,
                    photoURL: user.photoURL,
                    lastLogin: serverTimestamp(),
                    role: 'super_admin',
                };
                await setDoc(userRef, superAdminData, { merge: true });
                userProfile = superAdminData;
            } else if (userDoc.exists()) {
                const existingData = userDoc.data() as UserProfile;
                userProfile = {
                    ...existingData,
                    // ensure role has a default value if not present
                    role: existingData.role || 'viewer',
                };
                 // Ensure lastLogin is updated without overwriting role
                await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
            } else {
                 const newViewerData: UserProfile = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email?.toLowerCase() || null,
                    photoURL: user.photoURL,
                    lastLogin: serverTimestamp(),
                    role: 'viewer',
                };
                await setDoc(userRef, newViewerData, { merge: true });
                userProfile = newViewerData;
            }
            
            if (!userProfile) {
              throw new Error("Could not create or retrieve user profile.");
            }

            const finalRole = userProfile.role;
            const isSuperAdmin = finalRole === 'super_admin';
            const isAdmin = isSuperAdmin || finalRole === 'admin';
            const isSchoolAdmin = finalRole === 'school_admin';
            const isSchoolHead = finalRole === 'school_head';

            setUserState({ 
                user, 
                profile: userProfile,
                isAdmin, 
                isSuperAdmin, 
                isSchoolAdmin,
                isSchoolHead,
                isUserLoading: false, 
                error: null 
            });

        } catch (e: any) {
           console.error("Firestore error during user handling:", e);
           toast({ variant: "destructive", title: "Login Error", description: "Could not verify your user profile." });
           await firebaseSignOut(auth);
           setUserState({ user: null, profile: null, isAdmin: false, isSuperAdmin: false, isSchoolAdmin: false, isSchoolHead: false, isUserLoading: false, error: e });
        }
    } else {
      setUserState({ user: null, profile: null, isAdmin: false, isSuperAdmin: false, isSchoolAdmin: false, isSchoolHead: false, isUserLoading: false, error: null });
    }
  }, [auth, firestore, toast]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      toast({
        variant: "destructive",
        title: "Sign-in Failed",
        description: getGoogleSignInErrorMessage(error),
      });
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserState({ user: null, profile: null, isAdmin: false, isSuperAdmin: false, isSchoolAdmin: false, isSchoolHead: false, isUserLoading: false, error: null });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleUser, (error) => {
        console.error("Auth state change error:", error);
        setUserState({ user: null, profile: null, isAdmin: false, isSuperAdmin: false, isSchoolAdmin: false, isSchoolHead: false, isUserLoading: false, error });
    });
    return () => unsubscribe();
  }, [handleUser, auth]);

  return { ...userState, signInWithGoogle, signOut };
};
