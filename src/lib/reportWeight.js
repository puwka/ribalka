/**
 * Parse catch weight into kilograms for sorting/filtering reports.
 * Supports: "5", "5 кг", "2 кг 300 г", "800 г", "840 гр", "1,5 кг".
 */
export function parseReportWeightKg(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;

  const s = String(raw).replace(/,/g, '.').toLowerCase().trim();
  if (!s) return null;

  // Longer unit tokens first: грамм / гр / г
  const G = String.raw`(?:грамм|гр\.?|г(?![а-яёa-z]))`;
  const KG = String.raw`(?:кг\.?|kg)`;

  // "2 кг 300 г" / "2кг300г"
  const kgAndG = s.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${KG}\s*(\d+(?:\.\d+)?)\s*${G}`));
  if (kgAndG) {
    const kg = Number(kgAndG[1]);
    const g = Number(kgAndG[2]);
    if (Number.isFinite(kg) && Number.isFinite(g)) return kg + g / 1000;
  }

  // grams only — "840 гр", "800 г" (must NOT become 840 kg)
  const gramsOnly = s.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${G}`));
  if (gramsOnly && !new RegExp(KG).test(s)) {
    const g = Number(gramsOnly[1]);
    return Number.isFinite(g) ? g / 1000 : null;
  }

  // kilograms
  const kgOnly = s.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${KG}`));
  if (kgOnly) {
    const kg = Number(kgOnly[1]);
    return Number.isFinite(kg) ? kg : null;
  }

  // bare number → kg (form placeholder is "5 кг")
  const bare = s.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (bare) {
    const n = Number(bare[1]);
    return Number.isFinite(n) ? n : null;
  }

  // fallback: first number; convert if grams mentioned
  const any = s.match(/(\d+(?:\.\d+)?)/);
  if (!any) return null;
  const n = Number(any[1]);
  if (!Number.isFinite(n)) return null;
  if (new RegExp(G).test(s) && !new RegExp(KG).test(s)) return n / 1000;
  return n;
}

/**
 * Prefer text label with units over stored weightKg — DB may have wrong values
 * like weight_kg=840 for label "840 гр" from an older parser.
 */
export function reportWeightKg(report) {
  if (!report) return null;
  const label = report.weight || report.weight_label || '';
  const fromLabel = parseReportWeightKg(label);
  if (fromLabel != null) return fromLabel;

  const direct = report.weightKg ?? report.weight_kg;
  if (direct != null && direct !== '' && Number.isFinite(Number(direct))) {
    const n = Number(direct);
    // Sanity: freshwater catch over 100 kg is almost always mis-stored grams
    if (n > 100) return n / 1000;
    return n;
  }
  return null;
}
