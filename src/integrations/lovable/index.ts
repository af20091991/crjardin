// Authentification OAuth via Supabase Auth (remplace le module Lovable Cloud).
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type Provider = "google" | "apple" | "microsoft" | "lovable";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: Provider, opts?: SignInOptions) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: (provider === "lovable"
          ? "google"
          : provider === "microsoft"
            ? "azure"
            : provider) as "google" | "apple" | "azure",
        options: {
          redirectTo: opts?.redirect_uri ?? `${window.location.origin}/`,
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error };
      return { redirected: true as const };
    },
  },
};
