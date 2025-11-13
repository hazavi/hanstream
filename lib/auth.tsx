"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirebaseConfigured = auth !== null;

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) {
      throw new Error("Firebase is not configured");
    }
    const res = await signInWithEmailAndPassword(auth, email, password);
    setUser(res.user);
    return res.user;
  }

  async function signUp(email: string, password: string) {
    if (!auth) {
      throw new Error("Firebase is not configured");
    }
    const res = await createUserWithEmailAndPassword(auth, email, password);
    setUser(res.user);
    return res.user;
  }

  async function signOut() {
    if (!auth) {
      throw new Error("Firebase is not configured");
    }
    await firebaseSignOut(auth);
    setUser(null);
  }

  async function signInWithGoogle() {
    if (!auth) {
      throw new Error("Firebase is not configured");
    }
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    setUser(res.user);
    return res.user;
  }

  async function resetPassword(email: string) {
    if (!auth) {
      throw new Error("Firebase is not configured");
    }
    await sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        resetPassword,
        isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
