import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getMyProfile, updateMyProfile } from "@/lib/profile";
import { SignaturePad } from "@/components/SignaturePad";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Profil & signature — Jardin Pro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [rate, setRate] = useState("70");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setCompanyName(profile.company_name ?? "");
      setRate(String(profile.hourly_rate ?? 70));
    }
  }, [profile]);

  const inv = () => qc.invalidateQueries({ queryKey: ["my-profile"] });

  const saveInfo = useMutation({
    mutationFn: () => updateMyProfile({
      display_name: displayName.trim() || null,
      company_name: companyName.trim() || null,
      hourly_rate: Number(rate) || 70,
    }),
    onSuccess: () => { inv(); toast.success("Profil enregistré"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const saveSig = useMutation({
    mutationFn: (data: string | null) => updateMyProfile({ signature_data: data }),
    onSuccess: () => { inv(); toast.success("Signature enregistrée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <AppShell title="Profil & signature">
      <div className="mx-auto max-w-2xl space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-serif text-lg font-semibold">Informations</h3>
                <div className="space-y-1.5">
                  <Label>Votre nom (auteur des fiches)</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jean Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom de l'entreprise</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Jardin Pro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tarif horaire de main-d'œuvre (€ TTC/h)</Label>
                  <Input type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Utilisé pour estimer le prix des préconisations.</p>
                </div>
                <Button disabled={saveInfo.isPending} onClick={() => saveInfo.mutate()}>
                  {saveInfo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <PenLine className="h-5 w-5 text-primary" />
                  <h3 className="font-serif text-lg font-semibold">Votre signature</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Dessinez votre signature une seule fois. Elle sera automatiquement ajoutée à chacun de vos comptes-rendus PDF.
                </p>
                <SignaturePad value={profile?.signature_data} saving={saveSig.isPending} onSave={(d) => saveSig.mutate(d)} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
