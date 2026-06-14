// Lecture de texte depuis un fichier PDF ou Word (.docx) — côté navigateur uniquement.

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractFromPdf(file);
  }
  if (name.endsWith(".docx") || file.type.includes("word") || file.type.includes("officedocument")) {
    return extractFromDocx(file);
  }
  // Fallback : tenter le texte brut
  return file.text();
}

async function extractFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  const workerUrl = workerMod.default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => ("str" in it ? it.str : ""));
    text += strings.join(" ") + "\n";
  }
  return text;
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Transforme un texte de planning en liste de tâches.
// Une tâche par ligne non vide ; on retire les puces et numérotations.
export function parseTasksFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tasks: string[] = [];
  for (const raw of lines) {
    // découpe aussi sur les puces inline
    const parts = raw.split(/\s[•·▪‣◦*]\s|^[-–—]\s/).filter(Boolean);
    for (let p of parts) {
      let cleaned = p
        .replace(/^[\s•·▪‣◦*\-–—]+/, "")
        .replace(/^\d+[.)]\s*/, "")
        .trim();
      if (cleaned.length < 2) continue;
      // ignore les titres trop longs (paragraphes)
      if (cleaned.length > 120) continue;
      tasks.push(cleaned);
    }
  }
  // déduplication en gardant l'ordre
  return Array.from(new Set(tasks));
}