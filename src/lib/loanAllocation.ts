import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Crea préstamos (loans) y actualiza unidades al aprobar una solicitud.
 * Usado desde Dashboard y desde la página Solicitudes al confirmar aprobación.
 */
export async function allocateAndCreateLoans(
  supabase: SupabaseClient,
  req: {
    id: string;
    resource_id?: string;
    resources?: { id?: string; name?: string; type?: string; initial_quantity?: number };
    organization_id?: string;
    user_id?: string;
    profiles?: { id?: string };
    quantity?: number;
    needed_until?: string;
    return_by?: string;
    requested_unit_ids?: string[] | null;
  },
  currentUserId: string
): Promise<void> {
  const quantity = req.quantity ?? 1;
  const resourceId = req.resource_id ?? req.resources?.id;
  if (!resourceId) throw new Error('No se pudo identificar el recurso de la solicitud');

  let resourceType = req.resources?.type;
  if (!resourceType) {
    const { data: resourceInfo, error: resourceError } = await supabase
      .from('resources')
      .select('type, initial_quantity, name')
      .eq('id', resourceId)
      .single();
    if (resourceError) throw resourceError;
    resourceType = resourceInfo?.type;
    req.resources = {
      ...req.resources,
      type: resourceInfo?.type,
      initial_quantity: resourceInfo?.initial_quantity,
      name: req.resources?.name ?? resourceInfo?.name,
    };
  }

  let orgId = req.organization_id;
  if (!orgId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', currentUserId)
      .single();
    orgId = profile?.organization_id ?? undefined;
  }
  if (!orgId) throw new Error('No se pudo determinar la organización');

  let selected: { id: string }[];
  const requestedIds = Array.isArray(req.requested_unit_ids) ? req.requested_unit_ids.filter(Boolean) : [];

  if (requestedIds.length === quantity) {
    const { data: units, error: unitsErr } = await supabase
      .from('resource_units')
      .select('id, status')
      .in('id', requestedIds)
      .eq('resource_id', resourceId)
      .eq('status', 'available');
    if (unitsErr) throw unitsErr;
    if (!units || units.length < quantity) {
      throw new Error('Algunas unidades elegidas ya no están disponibles. Asigna según disponibilidad.');
    }
    selected = units;
  } else {
    const { data: units, error: unitsErr } = await supabase
      .from('resource_units')
      .select('id, status')
      .eq('resource_id', resourceId)
      .eq('status', 'available')
      .limit(quantity);
    if (unitsErr) throw unitsErr;
    selected = units ?? [];
    if (selected.length < quantity) {
      throw new Error('No hay unidades disponibles suficientes para cubrir la solicitud');
    }
  }

  const start = new Date().toISOString().split('T')[0];
  const dueDate = req.needed_until ?? req.return_by;
  const due =
    typeof dueDate === 'string' && dueDate.length >= 10
      ? dueDate.slice(0, 10)
      : new Date().toISOString().split('T')[0];
  const borrower = req.user_id ?? req.profiles?.id ?? currentUserId;
  const resourceName = req.resources?.name ?? 'recurso';

  if (resourceType !== 'reusable') {
    const currentStock = Number(req.resources?.initial_quantity ?? 0);
    if (currentStock < quantity) {
      throw new Error('No hay stock suficiente para cubrir la solicitud.');
    }

    const { error: stockError } = await supabase
      .from('resources')
      .update({
        initial_quantity: currentStock - quantity,
        status: currentStock - quantity > 0 ? 'available' : 'inactive',
      })
      .eq('id', resourceId);
    if (stockError) throw stockError;

    try {
      await supabase.from('activity_logs').insert({
        action: 'stock_allocated',
        entity_type: 'resource',
        entity_id: resourceId,
        user_id: currentUserId,
        details: {
          message: `Stock descontado de "${resourceName}"`,
          quantity,
          remaining_stock: currentStock - quantity,
        },
      });
    } catch (_) {}

    return;
  }

  for (const unit of selected) {
    const { error: insErr } = await supabase.from('loans').insert({
      unit_id: unit.id,
      user_id: borrower,
      request_id: req.id,
      organization_id: orgId,
      start_date: start,
      due_date: due,
      status: 'active',
    });

    if (insErr) throw new Error(insErr.message ?? 'No se pudo crear el préstamo.');

    try {
      await supabase.from('activity_logs').insert({
        action: 'loan_created',
        entity_type: 'loan',
        entity_id: req.id,
        user_id: currentUserId,
        details: {
          message: `Préstamo de "${resourceName}" asignado`,
          actor_name: undefined,
        },
      });
    } catch (_) {}

    const { error: upErr } = await supabase
      .from('resource_units')
      .update({ status: 'on_loan' })
      .eq('id', unit.id);
    if (upErr) throw upErr;
  }
}
