import { ChevronDown, Cloud, CloudRain, Droplets, Snowflake, Sun, Umbrella } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatHour,
  formatHumidity,
  formatRain,
  formatTemperature,
  hasDayFields,
  type WeatherCategory,
  type WeatherDay,
  type WeatherFields,
} from "@/lib/meteo-sst";

const ICONS: Record<WeatherCategory, typeof Sun> = {
  soleil: Sun,
  nuageux: Cloud,
  pluie: CloudRain,
  neige: Snowflake,
};

const TONES: Record<WeatherCategory, string> = {
  soleil: "text-accent",
  nuageux: "text-muted-foreground",
  pluie: "text-primary",
  neige: "text-muted-foreground",
};

const CATEGORY_LABELS: Record<WeatherCategory, string> = {
  soleil: "Soleil",
  nuageux: "Nuageux",
  pluie: "Pluie",
  neige: "Neige",
};

function WeatherIcon({
  category,
  label,
  className,
}: {
  category: WeatherCategory | null;
  label?: string | null;
  className?: string;
}) {
  if (!category) return <span className="text-muted-foreground">—</span>;
  const Icon = ICONS[category];
  return (
    <Icon
      className={cn("h-3.5 w-3.5 shrink-0", TONES[category], className)}
      aria-label={label ?? CATEGORY_LABELS[category]}
      role="img"
    />
  );
}

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Météo prévue d'une journée, sur une ligne compacte. Les champs affichés sont ceux
 * choisis par l'utilisateur ; si le détail heure par heure est activé, un clic ouvre
 * le tableau des 24 heures.
 */
export function SstWeatherStrip({
  day,
  fields,
  dateLabel,
}: {
  day: WeatherDay;
  fields: WeatherFields;
  dateLabel: string;
}) {
  const showDay = hasDayFields(fields);
  if (!showDay && !fields.hourly) return null;

  const content = (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
      {fields.condition || !showDay ? (
        <WeatherIcon category={day.category} label={day.label} />
      ) : null}
      {fields.temperature ? (
        <span className="font-medium text-foreground" title="Températures maximale / minimale">
          {formatTemperature(day.temperatureMax)}/{formatTemperature(day.temperatureMin)}
        </span>
      ) : null}
      {fields.humidity ? (
        <span className="inline-flex items-center gap-0.5" title="Humidité moyenne de la journée">
          <Droplets className="h-3 w-3" aria-hidden />
          {formatHumidity(day.humidityMean)}
        </span>
      ) : null}
      {fields.rain ? (
        <span className="inline-flex items-center gap-0.5" title="Pluviométrie annoncée">
          <Umbrella className="h-3 w-3" aria-hidden />
          {formatRain(day.precipitationSum)}
        </span>
      ) : null}
      {fields.hourly ? <ChevronDown className="ml-auto h-3 w-3 shrink-0" aria-hidden /> : null}
    </span>
  );

  if (!fields.hourly) {
    return (
      <div className="rounded-md bg-muted/40 px-1 py-0.5" title={day.label ?? undefined}>
        {content}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={stop}
          onKeyDown={stop}
          className="w-full rounded-md bg-muted/40 px-1 py-0.5 text-left transition-colors hover:bg-muted"
          title="Ouvrir pour plus de détails"
          aria-label={`Météo du ${dateLabel} : ouvrir pour plus de détails, heure par heure`}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[90vw] space-y-2"
        onClick={stop}
        onKeyDown={stop}
      >
        <HourlyDetail day={day} fields={fields} dateLabel={dateLabel} />
      </PopoverContent>
    </Popover>
  );
}

function HourlyDetail({
  day,
  fields,
  dateLabel,
}: {
  day: WeatherDay;
  fields: WeatherFields;
  dateLabel: string;
}) {
  // Si aucune colonne n'est cochée, le détail affiche tout : il est ouvert à dessein.
  const all = !fields.condition && !fields.temperature && !fields.humidity && !fields.rain;
  const cols = {
    condition: all || fields.condition,
    temperature: all || fields.temperature,
    humidity: all || fields.humidity,
    rain: all || fields.rain,
  };
  const template = [
    "3rem",
    cols.condition ? "1.5rem" : null,
    cols.temperature ? "2.75rem" : null,
    cols.humidity ? "3rem" : null,
    cols.rain ? "1fr" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div>
        <p className="text-sm font-semibold capitalize">{dateLabel}</p>
        <p className="text-xs text-muted-foreground">
          {day.label ?? "Conditions indisponibles"} · {formatTemperature(day.temperatureMax)} /{" "}
          {formatTemperature(day.temperatureMin)} · {formatRain(day.precipitationSum)}
        </p>
      </div>
      {day.hours.length === 0 ? (
        <p className="text-xs text-muted-foreground">Détail horaire indisponible pour ce jour.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-md border border-border text-xs">
          <div
            className="sticky top-0 grid items-center gap-x-2 border-b border-border bg-muted px-2 py-1 font-semibold text-muted-foreground"
            style={{ gridTemplateColumns: template }}
          >
            <span>Heure</span>
            {cols.condition ? <span /> : null}
            {cols.temperature ? <span>Temp.</span> : null}
            {cols.humidity ? <span>Humid.</span> : null}
            {cols.rain ? <span>Pluie</span> : null}
          </div>
          {day.hours.map((hour) => (
            <div
              key={hour.time}
              className="grid items-center gap-x-2 border-b border-border/60 px-2 py-1 last:border-0"
              style={{ gridTemplateColumns: template }}
            >
              <span className="font-medium">{formatHour(hour.hour)}</span>
              {cols.condition ? <WeatherIcon category={hour.category} label={hour.label} /> : null}
              {cols.temperature ? <span>{formatTemperature(hour.temperature)}</span> : null}
              {cols.humidity ? <span>{formatHumidity(hour.humidity)}</span> : null}
              {cols.rain ? (
                <span>
                  {formatRain(hour.precipitation)}
                  {hour.probability != null ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {Math.round(hour.probability)} %
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
