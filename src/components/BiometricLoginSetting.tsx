import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  biometricLoginEnabled,
  canOfferBiometricLogin,
  forgetBiometricLogin,
  saveBiometricLogin,
} from "@/lib/biometric-login";
import { isNativeApp } from "@/lib/native-app";

/** Réglage « Connexion par empreinte » — visible uniquement dans l'appli mobile compatible. */
export function BiometricLoginSetting() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    setOn(biometricLoginEnabled());
    void canOfferBiometricLogin().then(setAvailable);
  }, []);

  if (!available || !user?.email) return null;

  const enable = async () => {
    if (!password) return;
    setBusy(true);
    try {
      // Vérifie le mot de passe avant de le ranger dans le coffre du téléphone.
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });
      if (error) throw error;
      const saved = await saveBiometricLogin(user.email!, password);
      if (!saved) throw new Error("Enregistrement impossible sur cet appareil.");
      setOn(true);
      setPassword("");
      toast.success("Connexion par empreinte activée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    await forgetBiometricLogin();
    setOn(false);
    setBusy(false);
    toast.success("Connexion par empreinte désactivée.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Connexion par empreinte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {on ? (
          <>
            <p className="text-muted-foreground">
              Activée : sur l'écran de connexion, utilisez l'empreinte ou le visage.
            </p>
            <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
              Désactiver
            </Button>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void enable();
            }}
          >
            <p className="text-muted-foreground">
              Saisissez votre mot de passe une fois pour l'activer.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="pp-bio-password">Mot de passe</Label>
              <Input
                id="pp-bio-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy || !password}>
              Activer la connexion par empreinte
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
