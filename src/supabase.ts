import { createClient } from "@supabase/supabase-js";

// Retrieve environment variables with fallback
const supabaseUrl = (((import.meta as any).env?.VITE_SUPABASE_URL) || "").trim();
const supabaseAnonKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || "").trim();

// Create the Supabase client. If credentials are missing, we log a warning
// and the app will gracefully fallback to localStorage mode without crashing.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn("Supabase credentials missing. Saisha OS is running in standalone localStorage mode.");
}

/**
 * Trigger Supabase Sign In with Google
 */
export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured.");

  const redirectUrl = window.location.origin;
  const isIframe = typeof window !== "undefined" && window.self !== window.top;
  console.log("[signInWithGoogle] Initiating Google OAuth with redirectUrl:", redirectUrl, "isIframe:", isIframe);

  // When inside an iframe (like AI Studio preview), use skipBrowserRedirect so we can break out of iframe safely.
  // In standalone/production browsers (laptop and mobile), let Supabase perform native top-level browser redirect.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: isIframe,
    },
  });

  if (error) {
    console.error("[signInWithGoogle] Supabase OAuth initialization error:", error);
    throw error;
  }

  if (isIframe && data?.url) {
    console.log("[signInWithGoogle] Received Supabase OAuth URL for iframe breakout:", data.url);
    const opened = window.open(data.url, "_blank");
    if (!opened) {
      try {
        window.top!.location.href = data.url;
      } catch {
        window.location.href = data.url;
      }
    }
  }
}

/**
 * Trigger Supabase Sign Up with Email and Password
 */
export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  console.log("[signUpWithEmail] Initiating sign up request to Supabase for:", email);
  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin
    }
  });
  console.log("[signUpWithEmail] Raw sign up response from Supabase:", {
    hasData: !!result.data,
    hasUser: !!result.data?.user,
    hasSession: !!result.data?.session,
    userId: result.data?.user?.id,
    error: result.error
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * Trigger Supabase Sign In with Email and Password
 */
export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  console.log("[signInWithPassword] Initiating login request to Supabase for:", email);
  const result = await supabase.auth.signInWithPassword({
    email,
    password
  });
  console.log("[signInWithPassword] Raw login response from Supabase:", {
    hasData: !!result.data,
    hasUser: !!result.data?.user,
    hasSession: !!result.data?.session,
    userId: result.data?.user?.id,
    sessionExpiresAt: result.data?.session?.expires_at,
    error: result.error
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * Trigger Supabase Sign Out
 */
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
