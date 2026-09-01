import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { getSiteWebSourcesStatus } from "@/lib/site-web-status.functions";

/**
 * Configuration panel showing status of all external sources.
 * Used in Site web dashboard to indicate which integrations are active.
 */
export async function SiteWebSourcesStatus() {
  const status = await getSiteWebSourcesStatus();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base font-semibold">
            Intégrations externes
          </h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Search Console */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            {status.searchConsole ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Google Search Console</span>
          </div>
          <Badge
            variant={status.searchConsole ? "default" : "outline"}
            className="font-normal"
          >
            {status.searchConsole ? "Connecté" : "À connecter"}
          </Badge>
        </div>

        {/* Analytics */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            {status.analytics ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Google Analytics</span>
          </div>
          <Badge
            variant={status.analytics ? "default" : "outline"}
            className="font-normal"
          >
            {status.analytics ? "Connecté" : "À connecter"}
          </Badge>
        </div>

        {/* Business Profile */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            {status.businessProfile ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Fiche Établissement</span>
          </div>
          <Badge
            variant={status.businessProfile ? "default" : "outline"}
            className="font-normal"
          >
            {status.businessProfile ? "Connecté" : "À connecter"}
          </Badge>
        </div>
      </div>

      {!status.allConnected && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">
            ⚠️ Certaines intégrations ne sont pas configurées. Le tableau de bord
            affichera des données de démonstration jusqu'à leur activation.
          </p>
        </div>
      )}
    </Card>
  );
}
