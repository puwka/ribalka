import { localAuthStore } from '../lib/localAuthStore';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { api, apiDataEnabled } from '../lib/apiClient';
import { basesService } from './basesService';
import { reportSocialService } from './reportSocialService';
import { forumService } from './forumService';
import { paymentService } from './paymentService';
import { advertisingService } from './advertisingService';
import { plansService } from './plansService';
import { bookingsDb } from '../lib/bookingsDb';
import { catalogStats } from '../lib/catalogSeed';
import { auditService } from './auditService';
import { listingPaymentService } from './listingPaymentService';

async function countUsers() {
  if (apiDataEnabled) {
    try {
      const rows = await api.get('/api/users');
      return Array.isArray(rows) ? rows.length : 0;
    } catch {
      return 0;
    }
  }
  if (supabaseDataEnabled && supabase) {
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    return count || 0;
  }
  return localAuthStore.listUsersForAdmin().length;
}

async function countNewUsers(days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  if (apiDataEnabled) {
    try {
      const rows = await api.get('/api/users');
      return (rows || []).filter((u) => String(u.created_at || '') >= since).length;
    } catch {
      return 0;
    }
  }
  if (supabaseDataEnabled && supabase) {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);
    return count || 0;
  }
  return localAuthStore.listUsersForAdmin().filter((u) => u.created_at >= since).length;
}

export const adminDashboardService = {
  async getStats() {
    const [users, newUsers, pendingBases, pendingReports, pendingForum, payments, plans, ads] =
      await Promise.all([
        countUsers(),
        countNewUsers(7),
        basesService.listForModeration('pending').catch(() => []),
        reportSocialService.listForModeration('pending').catch(() => []),
        forumService.listForModeration('pending').catch(() => []),
        paymentService.listAll().catch(() => []),
        plansService.list().catch(() => []),
        advertisingService.listForModeration('pending').catch(() => []),
      ]);

    const waters = catalogStats();
    let owners = 0;
    let revenue = 0;
    let paymentsTotal = payments.length;

    if (apiDataEnabled) {
      try {
        const users = await api.get('/api/users');
        owners = (users || []).filter(
          (u) => u.primary_role === 'owner' || (u.roles || []).includes('owner')
        ).length;
      } catch {
        owners = 0;
      }
      try {
        const orders = await listingPaymentService.listAdmin({});
        paymentsTotal = orders.length;
        revenue = orders
          .filter((o) => o.status === 'paid')
          .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      } catch {
        /* keep payments from paymentService */
      }
    } else {
      owners = supabaseDataEnabled
        ? 0
        : localAuthStore.listUsersForAdmin().filter((u) => u.primary_role === 'owner').length;
      revenue = payments
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }

    let bookings = [];
    try {
      bookings = await bookingsDb.listAll();
    } catch {
      bookings = [];
    }

    const activePlans = plans.filter((p) => p.is_active).length;

    return {
      users,
      newUsers,
      owners,
      watersTotal: waters.total,
      watersPaid: waters.paid,
      watersFree: waters.free,
      pendingBases: pendingBases.length,
      pendingReports: pendingReports.length,
      pendingForum: pendingForum.length,
      pendingAds: ads.length,
      bookingsTotal: bookings.length,
      bookingsPending: bookings.filter((b) => b.status === 'pending').length,
      paymentsTotal,
      revenue,
      activePlans,
    };
  },

  async getActivityFeed(limit = 20) {
    const items = [];

    try {
      const [bases, reports, users, payments] = await Promise.all([
        basesService.listForModeration('all').catch(() => []),
        reportSocialService.listForModeration('all').catch(() => []),
        supabaseDataEnabled && supabase
          ? unwrap(
              await supabase
                .from('users')
                .select('id, email, created_at, primary_role')
                .order('created_at', { ascending: false })
                .limit(10)
            )
          : localAuthStore.listUsersForAdmin().slice(0, 10),
        paymentService.listAll().catch(() => []),
      ]);

      for (const b of bases.slice(0, 5)) {
        items.push({
          id: `base-${b.id}`,
          type: 'base',
          title: b.name,
          meta: `Статус: ${b.status}`,
          at: b.submitted_at || b.updated_at || b.created_at,
          link: '/admin/bases',
        });
      }

      for (const r of reports.slice(0, 5)) {
        items.push({
          id: `report-${r.id}`,
          type: 'report',
          title: r.place || 'Отчёт',
          meta: `${r.author} · ${r.status}`,
          at: r.created_at || r.date,
          link: '/admin/reports',
        });
      }

      for (const u of users || []) {
        items.push({
          id: `user-${u.id}`,
          type: 'user',
          title: u.email,
          meta: `Роль: ${u.primary_role || 'user'}`,
          at: u.created_at,
          link: '/admin/users',
        });
      }

      for (const p of payments.slice(0, 5)) {
        items.push({
          id: `payment-${p.id}`,
          type: 'payment',
          title: `${p.amount} ₽`,
          meta: `${p.status} · ${p.provider || '—'}`,
          at: p.created_at || p.paid_at,
          link: '/admin/payments',
        });
      }
    } catch {
      /* partial feed ok */
    }

    try {
      const audit = await auditService.list(null, 10);
      for (const a of audit) {
        items.push({
          id: `audit-${a.id}`,
          type: 'audit',
          title: a.summary,
          meta: a.admin_name || a.admin_id,
          at: a.created_at,
          link: '/admin/audit',
        });
      }
    } catch {
      /* ignore */
    }

    return items
      .filter((i) => i.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, limit);
  },
};
