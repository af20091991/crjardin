import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ParsedPlanningItem {
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string | null;
  position: number;
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectPeriod(line: string) {
  const lower = line.toLocaleLowerCase("fr-FR");
  for (let index = 0; index < MONTHS.length; index += 1) {
    const month = MONTHS[index];
    const match = lower.match(new RegExp(`^\\s*${month}(?:\\s+(\\d+))?(?:\\s+(20\\d{2}))?\\s*$`));
    if (match) {
      return {
        month: index + 1,
        sequence: match[1] ? Number(match[1]) : 1,
        year: match[2] ? Number(match[2]) : null,
      };
    }
  }
  return null;
}

function inferYear(month: number, explicitYear: number | null, currentYear: number) {
  if (explicitYear != null) return explicitYear;
  return month >= new Date().getMonth() + 1 ? currentYear : currentYear + 1;
}

export async function parsePlanningPdf(bytes: Uint8Array, currentYear = new Date().getFullYear()) {
  const pdf = await getDocument({
    data: bytes,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ normalizeWhitespace: true });
      const items = content.items
        .filter((item): item is typeof item & { str: string } => "str" in item && Boolean(item.str.trim()))
        .map((item) => ({ text: normalize(item.str), x: item.transform[4], y: item.transform[5] }))
        .sort((a, b) => b.y - a.y || a.x - b.x);

      const pageLines: { y: number; texts: { x: number; text: string }[] }[] = [];
      for (const item of items) {
        let line = pageLines.find((candidate) => Math.abs(candidate.y - item.y) < 2.5);
        if (!line) {
          line = { y: item.y, texts: [] };
          pageLines.push(line);
        }
        line.texts.push({ x: item.x, text: item.text });
      }

      for (const line of pageLines.sort((a, b) => b.y - a.y)) {
        const text = normalize(line.texts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" "));
        if (text) lines.push(text);
      }
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  const items: ParsedPlanningItem[] = [];
  let current: ParsedPlanningItem | null = null;

  for (const line of lines) {
    const period = detectPeriod(line);
    if (period) {
      if (current) items.push(current);
      const year = inferYear(period.month, period.year, currentYear);
      current = {
        period_label: `${MONTHS[period.month - 1][0].toUpperCase()}${MONTHS[period.month - 1].slice(1)}${year ? ` ${year}` : ""}`,
        year,
        month: period.month,
        sequence: period.sequence,
        title: "Entretien du jardin",
        details: null,
        position: items.length,
      };
      continue;
    }

    if (!current) continue;
    if (/^planning d['’]entretien/i.test(line)) continue;
    if (/^(total entretien annuel|ce planning prévoit|ce planning ne prévoit pas|signature précédée|remise fidélité|sous-total|prix ttc)/i.test(line)) continue;
    if (/^\d+\s*(?:facturations?|interventions?)/i.test(line)) continue;

    current.details = normalize([current.details, line].filter(Boolean).join(" "));
  }

  if (current) items.push(current);
  return items.filter((item) => item.month != null && item.title);
}
