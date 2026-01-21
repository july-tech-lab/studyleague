import { supabase } from "@/utils/supabase";
import type { Session, User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  loadingUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  updateUserMetadata: (metadata: Record<string, any>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
};

type ProfileSummary = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type ProfileStoreValue = {
  profile: ProfileSummary | null;
  setProfile: (value: ProfileSummary | null) => void;
  clearProfile: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const ProfileStoreContext = createContext<ProfileStoreValue | null>(null);

export const buildRedirectUrl = () =>
  makeRedirectUri({
    scheme: "studyleague",
  });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profileStore, setProfileStore] = useState<ProfileSummary | null>(null);

  // Ensures the browser session is properly finished after redirect
  WebBrowser.maybeCompleteAuthSession();

  useEffect(() => {
    let isMounted = true;

    const syncSession = (session: Session | null) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { user_metadata } = currentUser;
        setProfileStore({
          id: currentUser.id,
          email: currentUser.email ?? null,
          username: user_metadata?.username ?? null,
          avatar_url: user_metadata?.avatar_url ?? null,
        });
      } else {
        setProfileStore(null);
      }
    };

    const loadSession = async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;
      if (error) {
        setUser(null);
        setProfileStore(null);
      } else {
        syncSession(data.session ?? null);
      }
      setLoadingUser(false);
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) {
          syncSession(session ?? null);
          setLoadingUser(false);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await refreshSession();
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    metadata: Record<string, any> = {}
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata, emailRedirectTo: buildRedirectUrl() },
      });

      if (error) throw error;
      await refreshSession();
      return { user: data.user ?? null, session: data.session ?? null };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfileStore(null);
    } finally {
      setIsLoading(false);
      setLoadingUser(false);
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("delete_current_user");
      if (error) throw error;
      setUser(null);
      setProfileStore(null);
    } finally {
      setIsLoading(false);
      setLoadingUser(false);
    }
  };

  const refreshSession = async () => {
    setLoadingUser(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session ?? null;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { user_metadata } = currentUser;
        setProfileStore({
          id: currentUser.id,
          email: currentUser.email ?? null,
          username: user_metadata?.username ?? null,
          avatar_url: user_metadata?.avatar_url ?? null,
        });
      } else {
        setProfileStore(null);
      }
      return session;
    } finally {
      setLoadingUser(false);
    }
  };

  const updateUserMetadata = async (metadata: Record<string, any>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: metadata,
      });
      if (error) throw error;
      // Automatically refresh session to sync state across the app
      await refreshSession();
    } finally {
      setIsLoading(false);
    }
  };

  const profileStoreValue = useMemo(
    () => ({
      profile: profileStore,
      setProfile: setProfileStore,
      clearProfile: () => setProfileStore(null),
    }),
    [profileStore]
  );

  const signInWithOAuthProvider = async (provider: "google" | "apple") => {
    const redirectTo = buildRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error("URL de connexion indisponible.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== "success" || !result.url) {
      throw new Error("Connexion annulée ou interrompue.");
    }

    const authCode = new URL(result.url).searchParams.get("code");
    if (!authCode) {
      throw new Error("Code OAuth manquant.");
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(authCode);
    if (exchangeError) throw exchangeError;
  };

  const signInWithGoogle = async () => {
    await signInWithOAuthProvider("google");
  };

  const signInWithApple = async () => {
    if (Platform.OS !== "ios") {
      throw new Error("Apple Sign-In est disponible uniquement sur iOS.");
    }

    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Apple Sign-In n'est pas disponible sur cet appareil.");
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Jeton Apple manquant.");
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });

    if (error) throw error;
  };

  return (
    <ProfileStoreContext.Provider value={profileStoreValue}>
      <AuthContext.Provider
        value={{
          user,
          isLoading,
          loadingUser,
          signIn,
          signUp,
          signOut,
          deleteAccount,
          refreshSession,
          updateUserMetadata,
          signInWithGoogle,
          signInWithApple,
        }}
      >
        {children}
      </AuthContext.Provider>
    </ProfileStoreContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}

export function useProfileStore() {
  const ctx = useContext(ProfileStoreContext);
  if (!ctx) {
    throw new Error("useProfileStore must be used inside an AuthProvider");
  }
  return ctx;
}
