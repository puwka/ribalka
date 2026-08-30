import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';

export const bookingsService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  async create({ baseId, checkIn, checkOut, guestsCount, contactName, contactPhone, notes }) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    const base = unwrap(
      await supabase.from('bases').select('id, owner_id, type').eq('id', baseId).single()
    );
    if (base.type !== 'paid') {
      throw new Error('Bookings are only available for paid bases');
    }

    return unwrap(
      await supabase
        .from('bookings')
        .insert({
          base_id: baseId,
          user_id: user.id,
          owner_id: base.owner_id,
          check_in: checkIn,
          check_out: checkOut,
          guests_count: guestsCount ?? 1,
          contact_name: contactName,
          contact_phone: contactPhone,
          notes,
          status: 'pending',
        })
        .select('*')
        .single()
    );
  },

  async listMine() {
    if (!this.isEnabled()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    return unwrap(
      await supabase
        .from('bookings')
        .select('*, bases ( id, name )')
        .or(`user_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
    );
  },
};

export const notificationsService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  async listUnread() {
    if (!this.isEnabled()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    return unwrap(
      await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
    );
  },

  async markRead(id) {
    if (!this.isEnabled()) return;
    unwrap(
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
    );
  },
};

export const paymentsService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  /**
   * Creates a pending payment record.
   * Provider webhook / Edge Function should confirm status later.
   */
  async createIntent({ amount, currency = 'RUB', subscriptionId, bookingId, provider = 'manual' }) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    return unwrap(
      await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount,
          currency,
          subscription_id: subscriptionId ?? null,
          booking_id: bookingId ?? null,
          provider,
          status: 'pending',
        })
        .select('*')
        .single()
    );
  },
};
