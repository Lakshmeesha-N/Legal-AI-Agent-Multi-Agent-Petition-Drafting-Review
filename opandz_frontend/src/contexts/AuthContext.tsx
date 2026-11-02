"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  mockSignIn: (email?: string, name?: string) => void;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Start as false — show login page immediately, no loading screen on open
  const [loading, setLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    // Restore mock session
    const storedMockUser = localStorage.getItem("mock_user");
    const storedMockToken = localStorage.getItem("mock_token");
    if (storedMockUser && storedMockToken) {
      setUser(JSON.parse(storedMockUser));
      setToken(storedMockToken);
      setIsMock(true);
      return;
    }

    // Silently restore Firebase session in background (no loading spinner)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
          setToken(idToken);
          setIsMock(false);
        } catch (error) {
          console.error("Error getting ID token", error);
          setUser(null);
          setToken(null);
        }
      }
      // Don't clear user on null — already null by default
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
      setToken(idToken);
      setIsMock(false);
      localStorage.removeItem("mock_user");
      localStorage.removeItem("mock_token");
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
      setToken(idToken);
      setIsMock(false);
      localStorage.removeItem("mock_user");
      localStorage.removeItem("mock_token");
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
      setToken(idToken);
      setIsMock(false);
      localStorage.removeItem("mock_user");
      localStorage.removeItem("mock_token");
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      if (isMock) {
        localStorage.removeItem("mock_user");
        localStorage.removeItem("mock_token");
        setIsMock(false);
      } else {
        await firebaseSignOut(auth);
      }
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  const mockSignIn = (
    email = "lakshmeeshan1234@gmail.com",
    name = "Lakshmeesha N"
  ) => {
    const mockUser: AuthUser = {
      uid: "mock-uid-1234",
      email,
      displayName: name,
    };
    const mockToken = "mock-token-1234";
    setUser(mockUser);
    setToken(mockToken);
    setIsMock(true);
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
    localStorage.setItem("mock_token", mockToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        mockSignIn,
        isMock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
