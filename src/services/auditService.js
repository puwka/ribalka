import { cmsDb } from '../lib/cmsDb';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';

export const auditService = {
  async log({ adminId, adminName, action, entity, entityId, summary }) {
    const entry = {
      admin_id: adminId,
      admin_name: adminName || adminId,
      action,
      entity,
      entity_id: entityId || null,
      summary: summary || `${action} ${entity}`,
    };

    if (supabaseDataEnabled && supabase) {
      try {
        unwrap(
          await supabase.from('cms_audit_log').insert({
            ...entry,
            created_at: new Date().toISOString(),
          })
        );
      } catch {
        /* fallback to local */
      }
    }

    return cmsDb.addAudit(entry);
  },

  async list(adminId, limit = 100) {
    if (adminId) await assertAdmin(adminId);

    if (supabaseDataEnabled && supabase) {
      try {
        const rows = unwrap(
          await supabase
            .from('cms_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)
        );
        if (rows?.length) return rows;
      } catch {
        /* fallback */
      }
    }

    return cmsDb.listAudit(limit);
  },
};
