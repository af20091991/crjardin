import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  biometricAvailable,
  biometricUnlock,
  isBiometricEnabled,
  isNativeApp,
  setBiometricEnabled,
} from "@/lib/native-app";

/** Réglage « Verrouiller avec empreinte / visage » — visible uniquement dans l'appli mobile. */
export function BiometricLockSetting() {
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    setOn(isBiometricEnabled());
    void biometricAvailable().then(setAvailable);
  }, []);

  if (!available) return null;

  const toggle = async (next: boolean) => {
    if (next && !(await biometricUnlock())) return;
    setBiometricEnabled(next);
    setOn(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Sécurité de l'application</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="pp-biometric" className="text-sm">
          Verrouiller avec l'empreinte, le visage ou le code du téléphone
        </Label>
        <Switch id="pp-biometric" checked={on} onCheckedChange={toggle} />
      </CardContent>
    </Card>
  );
}
