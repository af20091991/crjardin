import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, PlusSquare, MoreVertical, Globe, ChevronDown } from "lucide-react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="pt-0.5 leading-snug">{children}</span>
    </li>
  );
}

export function ShareInstallGuide() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2.5">
            <Smartphone className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-serif text-lg font-semibold">
              Installer l'application sur votre téléphone
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-4 space-y-4 text-[0.95rem]">
            <p className="text-muted-foreground">
              Pour retrouver votre jardin plus facilement, vous pouvez ajouter
              un raccourci sur l'écran de votre téléphone. C'est gratuit et cela
              prend moins d'une minute.
            </p>

            {platform === "ios" && (
              <div className="space-y-3">
                <p className="font-medium">Sur iPhone ou iPad :</p>
                <ol className="space-y-3">
                  <Step n={1}>
                    Touchez le bouton <span className="font-semibold">Partager</span>
                    <Share className="mx-1 inline h-4 w-4 align-text-bottom" />
                    en bas de l'écran.
                  </Step>
                  <Step n={2}>
                    Faites glisser et touchez{" "}
                    <span className="font-semibold">« Sur l'écran d'accueil »</span>
                    <PlusSquare className="mx-1 inline h-4 w-4 align-text-bottom" />.
                  </Step>
                  <Step n={3}>
                    Touchez <span className="font-semibold">« Ajouter »</span> en haut
                    à droite. C'est terminé !
                  </Step>
                </ol>
              </div>
            )}

            {platform === "android" && (
              <div className="space-y-3">
                <p className="font-medium">Sur Android :</p>
                <ol className="space-y-3">
                  <Step n={1}>
                    Touchez le menu{" "}
                    <MoreVertical className="mx-1 inline h-4 w-4 align-text-bottom" />
                    (les trois points) en haut à droite.
                  </Step>
                  <Step n={2}>
                    Touchez{" "}
                    <span className="font-semibold">« Installer l'application »</span>{" "}
                    ou <span className="font-semibold">« Ajouter à l'écran d'accueil »</span>.
                  </Step>
                  <Step n={3}>
                    Confirmez. L'icône apparaît sur votre écran. C'est terminé !
                  </Step>
                </ol>
              </div>
            )}

            {platform === "other" && (
              <div className="space-y-3">
                <p className="font-medium">Depuis votre téléphone :</p>
                <ol className="space-y-3">
                  <Step n={1}>Ouvrez ce lien sur votre téléphone.</Step>
                  <Step n={2}>
                    Ouvrez le menu de votre navigateur (bouton{" "}
                    <span className="font-semibold">Partager</span> sur iPhone, ou les{" "}
                    <span className="font-semibold">trois points</span> sur Android).
                  </Step>
                  <Step n={3}>
                    Choisissez{" "}
                    <span className="font-semibold">« Sur l'écran d'accueil »</span> ou{" "}
                    <span className="font-semibold">« Installer l'application »</span>.
                  </Step>
                </ol>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p>
                <span className="font-medium text-foreground">
                  Vous ne souhaitez pas installer l'application ?
                </span>{" "}
                Aucun problème. Ce lien web reste toujours accessible : vous pouvez
                l'ouvrir à tout moment depuis votre téléphone ou votre ordinateur,
                ou l'ajouter à vos favoris.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}