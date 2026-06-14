import { useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarIcon,
  FileUp,
  ImagePlus,
  Loader2,
  Mail,
  Plus,
  Sprout,
  Trash2,
  X,
} from "lucide-react";

import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { extractTextFromFile, parseTasksFromText } from "@/lib/file-parser";
import { uploadPhoto, type UploadedPhoto } from "@/lib/storage";

const DOUBLON_EMAIL = "client@delagraineaujardin.com";

type TaskStatus = "pending" | "realise" | "reporte";

interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  note: string; // remarque (réalisé) ou motif (reporté)
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function RapportChantier() {
  const [nomClient, setNomClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [dateIntervention, setDateIntervention] = useState<Date | undefined>(
    new Date(),
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [travauxProchaine, setTravauxProchaine] = useState("");
  const [autresRemarques, setAutresRemarques] = useState("");

  const [parsing, setParsing] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [sending, setSending] = useState(false);

  const planningInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  async function handlePlanning(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsing(true);
    try {
      const text = await extractTextFromFile(file);
      const found = parseTasksFromText(text);
      if (found.length === 0) {
        toast.error("Aucune tâche détectée dans ce fichier.");
        return;
      }
      setTasks((prev) => {
        const existing = new Set(prev.map((t) => t.label.toLowerCase()));
        const added = found
          .filter((l) => !existing.has(l.toLowerCase()))
          .map<Task>((label) => ({ id: uid(), label, status: "pending", note: "" }));
        return [...prev, ...added];
      });
      toast.success(`${found.length} tâche(s) importée(s) du planning.`);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de lire ce fichier. Formats acceptés : PDF, Word (.docx).");
    } finally {
      setParsing(false);
    }
  }

  function addManualTask() {
    const label = newTask.trim();
    if (!label) return;
    setTasks((prev) => [...prev, { id: uid(), label, status: "pending", note: "" }]);
    setNewTask("");
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function setStatus(id: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === status ? "pending" : status } : t,
      ),
    );
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadPhoto(f)));
      setPhotos((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} photo(s) ajoutée(s).`);
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'envoi des photos.");
    } finally {
      setUploadingPhotos(false);
    }
  }

  function removePhoto(path: string) {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  }

  function buildReport(): string {
    const realises = tasks.filter((t) => t.status === "realise");
    const reportes = tasks.filter((t) => t.status === "reporte");
    const dateStr = dateIntervention
      ? format(dateIntervention, "EEEE d MMMM yyyy", { locale: fr })
      : "—";

    const lines: string[] = [];
    lines.push("RAPPORT DE FIN DE CHANTIER");
    lines.push("De la graine au jardin");
    lines.push("");
    lines.push(`Client : ${nomClient || "—"}`);
    lines.push(`Date d'intervention : ${dateStr}`);
    lines.push("");
    lines.push("— TRAVAUX RÉALISÉS —");
    if (realises.length) {
      realises.forEach((t) =>
        lines.push(`• ${t.label}${t.note ? ` (${t.note})` : ""}`),
      );
    } else {
      lines.push("Aucun");
    }
    lines.push("");
    lines.push("— TRAVAUX REPORTÉS —");
    if (reportes.length) {
      reportes.forEach((t) =>
        lines.push(`• ${t.label}${t.note ? ` — motif : ${t.note}` : ""}`),
      );
    } else {
      lines.push("Aucun");
    }
    lines.push("");
    if (travauxProchaine.trim()) {
      lines.push("— TRAVAUX PRÉVUS PROCHAINE INTERVENTION —");
      lines.push(travauxProchaine.trim());
      lines.push("");
    }
    if (autresRemarques.trim()) {
      lines.push("— AUTRES REMARQUES —");
      lines.push(autresRemarques.trim());
      lines.push("");
    }
    if (photos.length) {
      lines.push("— PHOTOS DU CHANTIER —");
      photos.forEach((p, i) => lines.push(`Photo ${i + 1} : ${p.url}`));
      lines.push("");
    }
    lines.push("Cordialement,");
    lines.push("De la graine au jardin");
    return lines.join("\n");
  }

  function handleSend() {
    if (!nomClient.trim()) {
      toast.error("Veuillez renseigner le nom du client.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClient.trim())) {
      toast.error("Veuillez renseigner une adresse email client valide.");
      return;
    }
    setSending(true);
    try {
      const subject = `Rapport d'intervention — ${nomClient.trim()}`;
      const body = buildReport();
      const mailto = `mailto:${encodeURIComponent(
        emailClient.trim(),
      )}?bcc=${encodeURIComponent(DOUBLON_EMAIL)}&subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      toast.success("Email préparé : une copie est envoyée à " + DOUBLON_EMAIL);
    } finally {
      setTimeout(() => setSending(false), 800);
    }
  }

  const realiseCount = tasks.filter((t) => t.status === "realise").length;
  const reporteCount = tasks.filter((t) => t.status === "reporte").length;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-5">
          <img
            src={logo}
            alt="Logo De la graine au jardin"
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold leading-tight text-foreground">
              Rapport de fin de chantier
            </h1>
            <p className="text-sm text-muted-foreground">
              De la graine au jardin · Envoi automatique au client
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Informations client */}
        <Section title="Informations client">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du client</Label>
              <Input
                id="nom"
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
                placeholder="M. et Mme Dupont"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse mail du client</Label>
              <Input
                id="email"
                type="email"
                value={emailClient}
                onChange={(e) => setEmailClient(e.target.value)}
                placeholder="client@email.com"
                maxLength={255}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Date d'intervention</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateIntervention && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateIntervention
                      ? format(dateIntervention, "EEEE d MMMM yyyy", { locale: fr })
                      : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateIntervention}
                    onSelect={setDateIntervention}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Section>

        {/* Planning */}
        <Section
          title="Planning d'entretien"
          description="Importez le planning (PDF ou Word) : les tâches prévues sont ajoutées automatiquement."
        >
          <input
            ref={planningInput}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handlePlanning}
          />
          <button
            type="button"
            onClick={() => planningInput.current?.click()}
            disabled={parsing}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-secondary/70 disabled:opacity-60"
          >
            {parsing ? (
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            ) : (
              <FileUp className="h-7 w-7 text-primary" />
            )}
            <span className="text-sm font-medium text-foreground">
              {parsing ? "Lecture du fichier…" : "Importer le planning d'entretien"}
            </span>
            <span className="text-xs text-muted-foreground">PDF ou Word (.docx)</span>
          </button>
        </Section>

        {/* Travaux */}
        <Section
          title="Travaux"
          description="Cochez « Réalisé » ou « Reporté » pour chaque tâche, puis ajoutez une remarque ou un motif."
        >
          {tasks.length > 0 && (
            <div className="mb-4 flex gap-3 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                {realiseCount} réalisé(s)
              </span>
              <span className="rounded-full bg-accent/20 px-3 py-1 font-medium text-accent-foreground">
                {reporteCount} reporté(s)
              </span>
            </div>
          )}

          <div className="space-y-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 font-medium text-foreground">{t.label}</p>
                  <button
                    type="button"
                    onClick={() => removeTask(t.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Supprimer la tâche"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={t.status === "realise" ? "default" : "outline"}
                    onClick={() => setStatus(t.id, "realise")}
                  >
                    Réalisé
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={t.status === "reporte" ? "secondary" : "outline"}
                    onClick={() => setStatus(t.id, "reporte")}
                  >
                    Reporté
                  </Button>
                </div>
                {t.status !== "pending" && (
                  <Input
                    value={t.note}
                    onChange={(e) => updateTask(t.id, { note: e.target.value })}
                    placeholder={
                      t.status === "realise"
                        ? "Remarque complémentaire (optionnel)"
                        : "Motif du report"
                    }
                    className="mt-3"
                    maxLength={300}
                  />
                )}
              </div>
            ))}

            {tasks.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune tâche pour le moment. Importez un planning ou ajoutez une tâche
                manuellement.
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManualTask())}
              placeholder="Ajouter une tâche manuellement"
              maxLength={120}
            />
            <Button type="button" variant="outline" onClick={addManualTask}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Section>

        {/* Photos */}
        <Section
          title="Photos du chantier"
          description="Ajoutez des photos avant / après ; elles seront jointes au rapport via un lien."
        >
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotos}
          />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <div
                key={p.path}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={p.url}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(p.path)}
                  className="absolute right-1 top-1 rounded-full bg-foreground/70 p-1 text-background opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Retirer la photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={uploadingPhotos}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
            >
              {uploadingPhotos ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
              <span className="text-xs">Ajouter</span>
            </button>
          </div>
        </Section>

        {/* Prochaine intervention */}
        <Section title="Travaux prévus — prochaine intervention">
          <Textarea
            value={travauxProchaine}
            onChange={(e) => setTravauxProchaine(e.target.value)}
            placeholder="Décrivez les travaux à prévoir lors de la prochaine intervention…"
            rows={4}
            maxLength={1500}
          />
        </Section>

        {/* Autres remarques */}
        <Section title="Autres remarques">
          <Textarea
            value={autresRemarques}
            onChange={(e) => setAutresRemarques(e.target.value)}
            placeholder="Informations complémentaires pour le client…"
            rows={4}
            maxLength={1500}
          />
        </Section>

        {/* Envoi */}
        <div className="sticky bottom-4 z-10">
          <Button
            type="button"
            size="lg"
            className="w-full shadow-lg"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Mail className="mr-2 h-5 w-5" />
            )}
            Envoyer le rapport au client
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <Sprout className="h-3.5 w-3.5" />
            Une copie est automatiquement envoyée à {DOUBLON_EMAIL}
          </p>
        </div>
      </main>
    </div>
  );
}