import { isSignupOpen } from "@/lib/signupAllowlist";
import { LoginForm } from "./LoginForm";

// ALLOWED_SIGNUP_EMAILS est lue à l'exécution : pas de rendu figé au build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm signupOpen={isSignupOpen()} />;
}
