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
  console.log("[signInWithGoogle] Initiating Google OAuth with redirectUrl:", redirectUrl);

  // Set skipBrowserRedirect: true and pass queryParams (prompt: 'consent select_account', access_type: 'offline').
  // This resolves:
  // 1. Google 403 framing error inside iframes (by opening the authorization in top-level window/tab).
  // 2. Google 403 test-user bypass (by forcing the account chooser so the whitelisted test user can be selected).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: "offline",
        prompt: "consent select_account"
      },
      skipBrowserRedirect: true
    }
  });

  if (error) {
    console.error("[signInWithGoogle] Supabase OAuth initialization error:", error);
    throw error;
  }

  if (data?.url) {
    console.log("[signInWithGoogle] Received Supabase OAuth URL:", data.url);
    const isIframe = window.self !== window.top;
    if (isIframe) {
      const opened = window.open(data.url, "_blank");
      if (!opened) {
        // Fallback to top or current window if popup blocker blocked it
        try {
          window.top!.location.href = data.url;
        } catch {
          window.location.href = data.url;
        }
      }
    } else {
      window.location.href = data.url;
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
