/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import type { GardenMarker } from "@/lib/worksite";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function GardenPlanMap({
  lat,
  lng,
  tasks,
  markers,
  onMarkersChange,
}: {
  lat: number | null;
  lng: number | null;
  tasks: string[];
  markers: GardenMarker[];
  onMarkersChange: (m: GardenMarker[]) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const overlays = useRef<google.maps.Marker[]>([]);
  const overlayById = useRef<Record<string, google.maps.Marker>>({});
  const infoWin = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const markersRef = useRef(markers);
  const activeTaskRef = useRef(activeTask);
  markersRef.current = markers;
  activeTaskRef.current = activeTask;

  // init map
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current) return;
        if (!mapObj.current) {
          mapObj.current = new g.maps.Map(mapRef.current, {
            center: { lat, lng },
            zoom: 19,
            mapTypeId: "satellite",
            tilt: 0,
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: true,
          });
          mapObj.current.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const task = activeTaskRef.current;
            if (!task) {
              toast.error("Choisissez d'abord une tâche à associer au repère");
              return;
            }
            const next = [
              ...markersRef.current,
              { id: uid(), lat: e.latLng.lat(), lng: e.latLng.lng(), task },
            ];
            onMarkersChange(next);
          });
        } else {
          mapObj.current.setCenter({ lat, lng });
        }
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur Google Maps"));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, onMarkersChange]);

  // re-center when address changes
  useEffect(() => {
    if (mapObj.current && lat != null && lng != null) {
      mapObj.current.setCenter({ lat, lng });
    }
  }, [lat, lng]);

  // render markers
  useEffect(() => {
    if (!ready || !mapObj.current) return;
    const g = window.google;
    if (!infoWin.current) infoWin.current = new g.maps.InfoWindow();
    overlays.current.forEach((m) => m.setMap(null));
    overlayById.current = {};
    overlays.current = markers.map((mk, i) => {
      const marker = new g.maps.Marker({
        position: { lat: mk.lat, lng: mk.lng },
        map: mapObj.current!,
        label: { text: String(i + 1), color: "#ffffff", fontWeight: "bold", fontSize: "12px" },
        title: mk.task,
      });
      marker.addListener("click", () => {
        const safe = mk.task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        infoWin.current!.setContent(
          `<div style="font-family:system-ui,sans-serif;font-size:13px;max-width:200px">
             <strong style="color:#4F8E33">Repère ${i + 1}</strong><br/>${safe}
           </div>`,
        );
        infoWin.current!.open({ map: mapObj.current!, anchor: marker });
      });
      overlayById.current[mk.id] = marker;
      return marker;
    });
  }, [markers, ready, onMarkersChange]);

  // highlight the hovered marker (bounce + raise)
  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    Object.entries(overlayById.current).forEach(([id, marker]) => {
      if (id === hoveredId) {
        marker.setAnimation(g.maps.Animation.BOUNCE);
        marker.setZIndex(999);
      } else {
        marker.setAnimation(null);
        marker.setZIndex(null);
      }
    });
  }, [hoveredId, ready, markers]);

  if (lat == null || lng == null) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        <MapPin className="h-6 w-6" />
        Renseignez l'adresse du chantier pour afficher la vue aérienne du jardin.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Repère à placer</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Sélectionnez une tâche puis cliquez sur le plan pour ajouter un repère.
            </div>
            <Select value={activeTask} onValueChange={setActiveTask}>
              <SelectTrigger><SelectValue placeholder="Choisir la tâche à repérer…" /></SelectTrigger>
              <SelectContent>
                {tasks.length === 0 ? (
                  <SelectItem value="__none" disabled>Ajoutez d'abord des travaux</SelectItem>
                ) : (
                  tasks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div ref={mapRef} className="h-72 w-full overflow-hidden rounded-lg border border-border bg-muted" />
          {markers.length > 0 && (
            <ul className="space-y-1.5">
              {markers.map((mk, i) => (
                <li
                  key={mk.id}
                  onMouseEnter={() => setHoveredId(mk.id)}
                  onMouseLeave={() => setHoveredId((cur) => (cur === mk.id ? null : cur))}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    hoveredId === mk.id ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{mk.task}</span>
                  <button type="button" className="text-destructive" onClick={() => onMarkersChange(markers.filter((x) => x.id !== mk.id))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
