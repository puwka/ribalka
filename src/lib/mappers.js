/**
 * Maps DB rows → shapes expected by current UI (bases.js / news / reports).
 * Keeps frontend stable while data source switches to Supabase.
 */

/**
 * @param {object} row
 * @param {{ images?: object[], videos?: object[], services?: object[] }} [rels]
 */
export function mapBaseToUi(row, rels = {}) {
  const images = (rels.images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img) => img.public_url || img.external_url || img.storage_path)
    .filter(Boolean);

  const videos = (rels.videos ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((vid) => vid.external_url || vid.public_url || vid.storage_path)
    .filter(Boolean);

  const services = (rels.services ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => s.name);

  const coords =
    row.lat != null && row.lng != null ? `${row.lat}, ${row.lng}` : null;

  return {
    id: row.id,
    name: row.name,
    short: row.short_description ?? '',
    description: row.description ?? '',
    price: row.price_label ?? null,
    services,
    fish: row.fish_species ?? '',
    address: row.address ?? '',
    coords,
    howToGet: row.how_to_get ?? row.conditions ?? '',
    transport: row.transport ?? '',
    weather: row.weather_notes ?? row.features ?? '',
    phone: row.phone ?? '',
    workHours: row.work_hours ?? '',
    website: row.website_url ?? '',
    contacts: row.contacts ?? '',
    social: row.social_links ?? {},
    region: row.region ?? '',
    conditions: row.conditions ?? '',
    features: row.features ?? '',
    images,
    videos,
    video: videos[0] ?? null,
    type: row.type,
    status: row.status,
    ownerId: row.owner_id,
    rejection_reason: row.rejection_reason ?? null,
  };
}

/**
 * @param {object} row
 */
export function mapNewsToUi(row) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? '',
    content: row.content,
    image: row.cover_url || row.cover_path || '',
    date: row.published_at
      ? String(row.published_at).slice(0, 10)
      : String(row.created_at).slice(0, 10),
    author: row.author_name || row.profiles?.display_name || 'Редакция',
    category: row.category ?? '',
    views: row.views_count ?? 0,
    slug: row.slug,
    status: row.status,
  };
}

/**
 * @param {object} row
 * @param {{ images?: object[], videos?: object[], comments?: object[], votedBy?: string[] }} [rels]
 */
export function mapReportToUi(row, rels = {}) {
  const images = (rels.images ?? [])
    .map((img) => img.public_url || img.external_url || img.storage_path)
    .filter(Boolean);

  const videos = (rels.videos ?? [])
    .map((vid) => vid.external_url || vid.public_url || vid.storage_path)
    .filter(Boolean);

  const comments = (rels.comments ?? []).map((c) => ({
    id: c.id,
    author: c.author_name,
    text: c.body,
    date: c.created_at,
    parentId: c.parent_id,
  }));

  return {
    id: row.id,
    author: row.author_name,
    place: row.place_name,
    date: row.trip_date,
    fish: row.fish_caught ?? '',
    bait: row.bait ?? '',
    weight: row.weight_label ?? '',
    description: row.description,
    images,
    videos,
    rating: row.rating_score ?? 0,
    votedBy: rels.votedBy ?? [],
    comments,
    createdAt: row.created_at,
    baseId: row.base_id,
    userId: row.user_id,
    status: row.status,
  };
}

/**
 * @param {object} row
 */
export function mapCalendarToUi(row) {
  return {
    id: row.id,
    name: row.title,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    fish: row.fish,
    description: row.description,
    region: row.region,
    severity: row.severity,
    entryType: row.entry_type,
    meta: row.meta ?? {},
  };
}

/**
 * Directory / ads ← advertising.ad_type = 'directory'
 * @param {object} row
 */
export function mapAdvertisingToDirectoryUi(row) {
  return {
    id: row.id,
    name: row.title,
    category: row.category || 'shop',
    description: row.description ?? '',
    image: row.image_url || row.image_path || '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    website: row.target_url ?? '',
    tags: row.tags ?? [],
  };
}
