export async function signInWithPassword(supabase, { email, password }) {
  return supabase.auth.signInWithPassword({
    email,
    password
  });
}

export async function signInWithGoogle(supabase, redirectTo) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo
    }
  });
}

export async function signUpWithPassword(supabase, { displayName, email, password }) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });
}

export async function sendPasswordResetEmail(supabase, { email, redirectTo }) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });
}

export async function updatePassword(supabase, { password }) {
  return supabase.auth.updateUser({
    password
  });
}
