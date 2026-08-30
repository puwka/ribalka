import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { mapCalendarToUi, mapAdvertisingToDirectoryUi } from '../lib/mappers';

export const calendarService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  /**
   * @param {{ year?: number, entryType?: string }} [filters]
   */
  async list(filters = {}) {
    if (!this.isEnabled()) return null;

    let query = supabase
      .from('calendar_data')
      .select('*')
      .eq('is_active', true)
      .order('start_date');

    if (filters.year) query = query.eq('year', filters.year);
    if (filters.entryType) query = query.eq('entry_type', filters.entryType);

    const rows = unwrap(await query);
    return (rows ?? []).map(mapCalendarToUi);
  },
};

export const directoryService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  async list() {
    if (!this.isEnabled()) return null;

    const rows = unwrap(
      await supabase
        .from('advertising')
        .select('*')
        .eq('ad_type', 'directory')
        .eq('status', 'active')
        .order('sort_order')
    );

    return (rows ?? []).map(mapAdvertisingToDirectoryUi);
  },
};
