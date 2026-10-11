import Link from "next/link";
import { SIGNUP_CLOSED_MESSAGE, isSignupOpen } from "@/lib/signupAllowlist";
import { RegisterForm } from "./RegisterForm";

// ALLOWED_SIGNUP_EMAILS est lue à l'exécution : pas de rendu figé au build.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // Liste vide ou absente : personne ne peut s'inscrire, le formulaire n'a aucun sens.
  if (!isSignupOpen()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">MindDump</h1>
            <p className="text-muted-foreground text-sm">Vide ta charge mentale</p>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-8 space-y-4">
            <h2 className="text-xl font-semibold">{SIGNUP_CLOSED_MESSAGE}</h2>
            <p className="text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <RegisterForm />;
}
