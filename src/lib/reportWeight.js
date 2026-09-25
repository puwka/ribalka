/**
 * Parse catch weight into kilograms for sorting/filtering reports.
 * Supports: "5", "5 кг", "2 кг 300 г", "800 г", "1,5 кг".
 */
export function parseReportWeightKg(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;

  const s = String(raw).replace(/,/g, '.').toLowerCase().trim();
  if (!s) return null;

  // "2 кг 300 г" / "2кг300г"
  const kgAndG = s.match(/(\d+(?:\.\d+)?)\s*кг\.?\s*(\d+(?:\.\d+)?)\s*(?:г|гр|грамм)/i);
  if (kgAndG) {
    const kg = Number(kgAndG[1]);
    const g = Number(kgAndG[2]);
    if (Number.isFinite(kg) && Number.isFinite(g)) return kg + g / 1000;
  }

  // grams only — avoid treating "800 г" as 800 kg
  const gramsOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:г|гр|грамм)/i);
  if (gramsOnly && !/кг|kg/.test(s)) {
    const g = Number(gramsOnly[1]);
    return Number.isFinite(g) ? g / 1000 : null;
  }

  // kilograms
  const kgOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:кг|kg)/i);
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

  // fallback: first number in the string, convert if unit is grams
  const any = s.match(/(\d+(?:\.\d+)?)/);
  if (!any) return null;
  const n = Number(any[1]);
  if (!Number.isFinite(n)) return null;
  if (/(?:г|гр|грамм)/.test(s) && !/(?:кг|kg)/.test(s)) return n / 1000;
  return n;
}

/** Normalize report object so weightKg is always usable for sorting */
export function reportWeightKg(report) {
  if (!report) return null;
  const direct = report.weightKg ?? report.weight_kg;
  if (direct != null && direct !== '' && Number.isFinite(Number(direct))) {
    return Number(direct);
  }
  return parseReportWeightKg(report.weight || report.weight_label || '');
}
