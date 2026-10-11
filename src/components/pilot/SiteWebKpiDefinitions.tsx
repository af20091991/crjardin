export function SiteWebKpiDefinitions() {
  return (
    <div className="mt-4 rounded-lg border border-border/70 p-4">
      <p className="text-sm font-medium">Définition des indicateurs</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Sessions · GA4.</span> Nombre de sessions
          enregistrées pendant la période.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Clics Google · Search Console.</span> Somme
          des clics quotidiens, sans filtre par requête.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Impressions · Search Console.</span> Somme
          des impressions quotidiennes, sans filtre par requête.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Position moyenne · Search Console.</span>{" "}
          Position quotidienne pondérée par les impressions.
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Période indiquée ci-dessus, données interrogées jusqu’à hier (retard possible). Actualisation
        à la demande avec le bouton « Actualiser ».
      </p>
    </div>
  );
}
