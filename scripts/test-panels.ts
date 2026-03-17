/**
 * Test de paneles — InvTrack
 *
 * Verifica que cada panel lee/escribe datos correctos y que los datos
 * generados en un panel aparecen correctamente en los demás.
 *
 * Paneles: Dashboard · Loans · Requests · Users · Reservations ·
 *          Departments · Locations · Reports · MyResources
 *
 * Uso:  npm run test:panels
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

// ─── Helpers de consola ───────────────────────────────────────────────────────
const ok   = (s: string) => `\x1b[32m✓ ${s}\x1b[0m`;
const fail = (s: string) => `\x1b[31m✗ ${s}\x1b[0m`;
const info = (s: string) => `\x1b[36m  ${s}\x1b[0m`;
const sec  = (s: string) => `\n\x1b[1m${s}\x1b[0m`;
const warn = (s: string) => `\x1b[33m  ⚠ ${s}\x1b[0m`;

let passed = 0; let failed = 0;
function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(ok(label)); passed++; }
  else       { console.log(fail(label) + (detail ? `  → ${detail}` : '')); failed++; }
}

// Objetos a limpiar al final
const cleanup: { table: string; col: string; val: string }[] = [];
const track = (table: string, id: string, col = 'id') => cleanup.push({ table, col, val: id });

// ─── Contexto global ─────────────────────────────────────────────────────────
let ORG_ID: string;
let ADMIN_ID: string;
let USER_ID: string;
const ts = Date.now();

// ─── Queries que replican cada panel ─────────────────────────────────────────

/** Dashboard: préstamos activos y vencidos */
async function dashboardLoans(orgId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data: active } = await db.from('loans')
    .select('id, status, due_date, resource_units(resource_id, resources(name, organization_id))')
    .eq('status', 'active');

  const orgLoans = (active ?? []).filter(
    (l: any) => l.resource_units?.resources?.organization_id === orgId
  );
  const overdue = orgLoans.filter((l: any) => l.due_date && l.due_date < today);
  return { active: orgLoans.length, overdue: overdue.length };
}

/** Dashboard: activity reciente */
async function dashboardActivity(orgId: string) {
  const { data } = await db.from('activity_logs')
    .select('id, action, entity_type, created_at')
    .order('created_at', { ascending: false }).limit(10);
  return data ?? [];
}

/** Loans panel: préstamos por status */
async function loansPanel(userId: string) {
  const { data } = await db.from('loans')
    .select('id, status, due_date, unit_id, resource_units(serial_number, resources(name))')
    .eq('user_id', userId);
  return data ?? [];
}

/** Requests panel: solicitudes pendientes de la org */
async function requestsPanel(orgId: string) {
  const { data } = await db.from('requests')
    .select('id, status, quantity, resource_id, user_id, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

/** Reports: loans + consumable checkouts */
async function reportsPanel(orgId: string) {
  const { data: loans } = await db.from('loans')
    .select('id, status, resource_units(resource_id, resources(organization_id))')
    .eq('status', 'returned');

  const orgReturned = (loans ?? []).filter(
    (l: any) => l.resource_units?.resources?.organization_id === orgId
  );

  const { data: consumables } = await db.from('activity_logs')
    .select('id, details').eq('action', 'stock_allocated');

  return { returned: orgReturned.length, consumableEvents: (consumables ?? []).length };
}

/** MyResources: préstamos activos del usuario */
async function myResourcesPanel(userId: string) {
  const { data: loans } = await db.from('loans')
    .select('id, status, due_date, resource_units(serial_number, resources(name))')
    .eq('user_id', userId)
    .neq('status', 'returned');

  const { data: consumables } = await db.from('activity_logs')
    .select('id, action, details').eq('action', 'consumable_checkout').eq('user_id', userId);

  return { loans: loans ?? [], consumables: consumables ?? [] };
}

/** Reservations: requests con fechas futuras */
async function reservationsPanel(orgId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db.from('requests')
    .select('id, status, needed_from, needed_until, quantity, resource_id')
    .eq('organization_id', orgId)
    .gte('needed_from', today)
    .in('status', ['pending', 'approved']);
  return data ?? [];
}

/** Departments panel */
async function departmentsPanel(orgId: string) {
  const { data } = await db.from('departments')
    .select('id, name, department_managers(user_id)')
    .eq('organization_id', orgId);
  return data ?? [];
}

/** Locations panel */
async function locationsPanel(orgId: string) {
  const { data } = await db.from('locations')
    .select('id, name, type, is_reservable, location_managers(user_id)')
    .eq('organization_id', orgId);
  return data ?? [];
}

/** Users panel: perfiles + invitaciones pendientes */
async function usersPanel(orgId: string) {
  // Use two separate queries to avoid PostgREST ambiguity (user_id + invited_by both → profiles)
  const { data: members } = await db.from('organization_memberships')
    .select('user_id, role')
    .eq('organization_id', orgId).eq('status', 'active');

  const { data: invitations } = await db.from('invitations')
    .select('id, email, role, accepted_at, expires_at')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString());

  return { members: members ?? [], invitations: invitations ?? [] };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\x1b[1m\n=== Test Paneles InvTrack — Interconexiones entre vistas ===\x1b[0m\n');

  // ══════════════════════════════════════════════════════════════════════════
  // 0. SETUP: org, perfiles, categoría
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('0. Setup'));

  const { data: memberships } = await db.from('organization_memberships')
    .select('organization_id, user_id, role').eq('status', 'active').limit(20);
  if (!memberships?.length) { console.error('Sin memberships activos'); process.exit(1); }

  const orgCounts: Record<string, number> = {};
  memberships.forEach(m => { orgCounts[m.organization_id] = (orgCounts[m.organization_id] ?? 0) + 1; });
  ORG_ID = Object.entries(orgCounts).sort((a, b) => b[1] - a[1])[0][0];

  const orgMembers = memberships.filter(m => m.organization_id === ORG_ID);
  ADMIN_ID = orgMembers.find(m => m.role === 'owner' || m.role === 'admin')?.user_id ?? orgMembers[0].user_id;
  USER_ID  = orgMembers.find(m => m.role === 'member')?.user_id ?? orgMembers[orgMembers.length - 1].user_id;

  const { data: org } = await db.from('organizations').select('name').eq('id', ORG_ID).single();
  const { data: adminP } = await db.from('profiles').select('full_name').eq('id', ADMIN_ID).single();
  const { data: userP  } = await db.from('profiles').select('full_name').eq('id', USER_ID).single();

  console.log(info(`Org: ${org?.name} (${ORG_ID})`));
  console.log(info(`Admin: ${adminP?.full_name} | Usuario: ${userP?.full_name}`));

  // ══════════════════════════════════════════════════════════════════════════
  // 1. DEPARTMENTS: crear → verificar en panel → asignar manager → recursos
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('1. Panel Departamentos'));

  const { data: dept, error: deptErr } = await db.from('departments').insert({
    name: `[TEST] Depto ${ts}`, organization_id: ORG_ID,
  }).select('id, name').single();

  assert(!deptErr && !!dept, 'Departamento creado');
  if (!dept) { console.error('Fallo crítico: sin departamento'); process.exit(1); }
  track('departments', dept.id);

  // Asignar manager
  const { error: mgrErr } = await db.from('department_managers').insert({
    department_id: dept.id, user_id: ADMIN_ID, is_primary: true,
  });
  assert(!mgrErr, 'Manager asignado al departamento');
  track('department_managers', dept.id, 'department_id');

  // Verificar que aparece en el panel
  const depts = await departmentsPanel(ORG_ID);
  const found = depts.find((d: any) => d.id === dept.id);
  assert(!!found, 'Departamento aparece en panel Departamentos');
  assert(
    (found?.department_managers?.length ?? 0) >= 1,
    `Manager visible en panel (${found?.department_managers?.length ?? 0} managers)`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 2. LOCATIONS: crear → panel → asignar manager → recurso con ubicación
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('2. Panel Ubicaciones'));

  const { data: loc, error: locErr } = await db.from('locations').insert({
    name: `[TEST] Sala ${ts}`, type: 'classroom', organization_id: ORG_ID,
    is_reservable: false, capacity: 10, department_id: dept.id,
  }).select('id, name').single();

  assert(!locErr && !!loc, 'Ubicación creada');
  if (!loc) { console.error('Fallo crítico: sin ubicación'); process.exit(1); }
  track('locations', loc.id);

  const { error: locMgrErr } = await db.from('location_managers').insert({
    location_id: loc.id, user_id: ADMIN_ID, is_primary: true,
  });
  assert(!locMgrErr, 'Manager asignado a la ubicación');
  track('location_managers', loc.id, 'location_id');

  const locs = await locationsPanel(ORG_ID);
  const foundLoc = locs.find((l: any) => l.id === loc.id);
  assert(!!foundLoc, 'Ubicación aparece en panel Ubicaciones');
  assert(
    (foundLoc?.location_managers?.length ?? 0) >= 1,
    `Manager visible en Ubicaciones (${foundLoc?.location_managers?.length ?? 0})`
  );

  // Ubicación reservable (para panel Reservas)
  const { data: locRes } = await db.from('locations').insert({
    name: `[TEST] Sala Reservable ${ts}`, type: 'classroom', organization_id: ORG_ID,
    is_reservable: true, capacity: 20, department_id: dept.id,
  }).select('id').single();
  if (locRes) track('locations', locRes.id);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. RESOURCES: con departamento y ubicación → visibles en sus paneles
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('3. Recursos vinculados a depto/ubicación'));

  const { data: resA } = await db.from('resources').insert({
    name: `[TEST] Recurso Panel A ${ts}`, sku: `TEST-PA-${ts}`,
    type: 'reusable', behavior: 'prestable',
    initial_quantity: 2, warehouse_quantity: 0,
    catalog_visibility: 'public', ownership_type: 'general',
    department_id: dept.id, location_id: loc.id,
    organization_id: ORG_ID, status: 'available', requires_approval: true,
  }).select('id').single();
  assert(!!resA, 'Recurso A creado con depto y ubicación');
  if (!resA) { console.error('Fallo crítico'); process.exit(1); }
  track('resources', resA.id);

  // Crear 2 unidades para resA
  const unitIds: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const { data: u } = await db.from('resource_units').insert({
      resource_id: resA.id, organization_id: ORG_ID,
      serial_number: `PA-${ts}-${i}`, status: 'available', condition: 'new',
    }).select('id').single();
    if (u) { unitIds.push(u.id); track('resource_units', u.id); }
  }
  assert(unitIds.length === 2, `2 unidades creadas para recurso A (${unitIds.length})`);

  // Recurso consumible
  const { data: resB } = await db.from('resources').insert({
    name: `[TEST] Recurso Panel B ${ts}`, sku: `TEST-PB-${ts}`,
    type: 'consumable', behavior: 'gastable',
    initial_quantity: 30, warehouse_quantity: 20,
    catalog_visibility: 'public', ownership_type: 'general',
    department_id: dept.id, location_id: loc.id,
    organization_id: ORG_ID, status: 'available', requires_approval: true,
  }).select('id').single();
  assert(!!resB, 'Recurso B consumible creado');
  if (!resB) { console.error('Fallo crítico'); process.exit(1); }
  track('resources', resB.id);

  // Recurso con filtro por departamento
  const { data: byDept } = await db.from('resources')
    .select('id').eq('organization_id', ORG_ID).eq('department_id', dept.id);
  assert((byDept?.length ?? 0) >= 2, `Recursos filtrables por departamento (${byDept?.length ?? 0})`);

  const { data: byLoc } = await db.from('resources')
    .select('id').eq('organization_id', ORG_ID).eq('location_id', loc.id);
  assert((byLoc?.length ?? 0) >= 2, `Recursos filtrables por ubicación (${byLoc?.length ?? 0})`);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. USERS + INVITACIONES: crear invitación → aparece en panel Users
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('4. Panel Usuarios + Invitaciones'));

  const before = await usersPanel(ORG_ID);
  assert(before.members.length >= 1, `Miembros activos visibles (${before.members.length})`);

  const testEmail = `test-invite-${ts}@invtrack.test`;
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { data: inv, error: invErr } = await db.from('invitations').insert({
    email: testEmail, role: 'member', organization_id: ORG_ID,
    token: `test-token-${ts}`, expires_at: expiresAt, invited_by: ADMIN_ID,
  }).select('id, email').single();

  assert(!invErr && !!inv, 'Invitación creada');
  if (inv) track('invitations', inv.id);

  const afterInv = await usersPanel(ORG_ID);
  const invFound = afterInv.invitations.find((i: any) => i.email === testEmail);
  assert(!!invFound, 'Invitación pendiente visible en panel Users');
  assert(invFound?.role === 'member', `Rol correcto en invitación (${invFound?.role})`);

  // Miembro con departamento asignado
  const { error: deptAssignErr } = await db.from('profiles')
    .update({ department_id: dept.id }).eq('id', USER_ID);
  assert(!deptAssignErr, 'Usuario asignado al departamento');

  const { data: userWithDept } = await db.from('profiles')
    .select('id, full_name, department_id').eq('id', USER_ID).single();
  assert(userWithDept?.department_id === dept.id, 'Departamento persiste en perfil del usuario');

  // ══════════════════════════════════════════════════════════════════════════
  // 5. REQUESTS: crear solicitudes → verificar en panel Solicitudes
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('5. Panel Solicitudes'));

  const reqsBefore = await requestsPanel(ORG_ID);
  const countBefore = reqsBefore.length;

  // Solicitud reutilizable
  const { data: reqReu } = await db.from('requests').insert({
    user_id: USER_ID, organization_id: ORG_ID, resource_id: resA.id,
    quantity: 1, urgency: 'normal', status: 'pending',
    notes: '[TEST] Panel solicitudes',
  }).select('id, status').single();
  assert(!!reqReu, 'Solicitud reutilizable creada');
  if (reqReu) track('requests', reqReu.id);

  // Solicitud consumible
  const { data: reqCon } = await db.from('requests').insert({
    user_id: USER_ID, organization_id: ORG_ID, resource_id: resB.id,
    quantity: 5, urgency: 'high', status: 'pending',
    notes: '[TEST] Panel solicitudes consumible',
  }).select('id, status').single();
  assert(!!reqCon, 'Solicitud consumible creada');
  if (reqCon) track('requests', reqCon.id);

  const reqsAfter = await requestsPanel(ORG_ID);
  assert(reqsAfter.length >= countBefore + 2, `Panel Solicitudes muestra nuevas solicitudes (${reqsAfter.length} total)`);

  // Filtro por status pending
  const pending = reqsAfter.filter((r: any) => r.status === 'pending');
  assert(pending.some((r: any) => r.id === reqReu?.id), 'Solicitud reutilizable aparece en pending');
  assert(pending.some((r: any) => r.id === reqCon?.id), 'Solicitud consumible aparece en pending');

  // ══════════════════════════════════════════════════════════════════════════
  // 6. APPROVE REUTILIZABLE → LOANS → DASHBOARD → MY RESOURCES
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('6. Aprobación reutilizable → Loans → Dashboard → MyResources'));

  // Aprobar solicitud reutilizable (asignar unidad)
  const unitId = unitIds[0];
  const today  = new Date().toISOString().split('T')[0];
  const due    = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const { data: loan, error: loanErr } = await db.from('loans').insert({
    unit_id: unitId, user_id: USER_ID, request_id: reqReu!.id,
    organization_id: ORG_ID, start_date: today, due_date: due, status: 'active',
  }).select('id, status').single();

  assert(!loanErr && !!loan, 'Loan creado al aprobar');
  if (loan) track('loans', loan.id);

  await db.from('resource_units').update({ status: 'on_loan' }).eq('id', unitId);
  await db.from('requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', reqReu!.id);

  // Activity log de aprobación
  const { error: actErr } = await db.from('activity_logs').insert({
    action: 'request_approved', entity_type: 'request', entity_id: reqReu!.id,
    user_id: ADMIN_ID,
    details: { resource_name: `[TEST] Recurso Panel A ${ts}`, quantity: 1 },
  });
  assert(!actErr, 'Activity log de aprobación registrado');

  // Dashboard: el loan activo ahora aparece
  const dash = await dashboardLoans(ORG_ID);
  assert(dash.active >= 1, `Dashboard muestra ≥1 loan activo (${dash.active})`);

  // MyResources: el usuario ve su préstamo
  const myRes = await myResourcesPanel(USER_ID);
  const myLoan = myRes.loans.find((l: any) => l.id === loan.id);
  assert(!!myLoan, 'Loan aparece en MyResources del usuario');
  assert(myLoan?.status === 'active', 'Estado = active en MyResources');

  // Panel Loans: el préstamo aparece
  const userLoans = await loansPanel(USER_ID);
  assert(userLoans.some((l: any) => l.id === loan.id), 'Préstamo visible en panel Loans');

  // Verificar unidad pasó a on_loan
  const { data: unitStatus } = await db.from('resource_units')
    .select('status').eq('id', unitId).single();
  assert(unitStatus?.status === 'on_loan', `Unidad = on_loan tras préstamo (${unitStatus?.status})`);

  // Verificar que request pasó a approved
  const reqAfter = await db.from('requests').select('status').eq('id', reqReu!.id).single();
  assert(reqAfter.data?.status === 'approved', 'Request en panel Solicitudes → approved');

  // ══════════════════════════════════════════════════════════════════════════
  // 7. APPROVE CONSUMIBLE → REPORTS → MY RESOURCES
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('7. Aprobación consumible → Reports → MyResources'));

  const { data: resBBefore } = await db.from('resources')
    .select('initial_quantity').eq('id', resB.id).single();
  const stockBefore = resBBefore?.initial_quantity ?? 30;

  // Descontar stock (simula allocateAndCreateLoans para consumible)
  const newStock = stockBefore - 5;
  await db.from('resources').update({
    initial_quantity: newStock, status: newStock > 0 ? 'available' : 'inactive',
  }).eq('id', resB.id);

  await db.from('activity_logs').insert({
    action: 'stock_allocated', entity_type: 'resource', entity_id: resB.id,
    user_id: ADMIN_ID, details: { quantity: 5, remaining_stock: newStock },
  });

  // También insertar consumable_checkout para MyResources del usuario
  await db.from('activity_logs').insert({
    action: 'consumable_checkout', entity_type: 'resource', entity_id: resB.id,
    user_id: USER_ID, details: { quantity: 5, resource_name: `[TEST] Recurso Panel B ${ts}` },
  });

  if (reqCon) await db.from('requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', reqCon.id);

  const { data: resBAfter } = await db.from('resources')
    .select('initial_quantity, warehouse_quantity').eq('id', resB.id).single();
  assert(resBAfter?.initial_quantity   === newStock, `Stock público bajó (${stockBefore}→${newStock})`);
  assert(resBAfter?.warehouse_quantity === 20,       `Almacén intacto = 20 (${resBAfter?.warehouse_quantity})`);

  // Reports: logs de consumible presentes
  const reports = await reportsPanel(ORG_ID);
  assert(reports.consumableEvents >= 1, `Reports muestra eventos consumible (${reports.consumableEvents})`);

  // MyResources: consumable_checkout del usuario
  const myRes2 = await myResourcesPanel(USER_ID);
  const myCheckout = myRes2.consumables.find((c: any) => c.details?.resource_name?.includes(`Panel B ${ts}`));
  assert(!!myCheckout, 'Consumable checkout visible en MyResources del usuario');

  // ══════════════════════════════════════════════════════════════════════════
  // 8. REJECT: solicitud rechazada → stock inalterado → aparece en panel
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('8. Rechazo → stock inalterado → visible en Solicitudes'));

  const { data: reqRej } = await db.from('requests').insert({
    user_id: USER_ID, organization_id: ORG_ID, resource_id: resB.id,
    quantity: 10, urgency: 'normal', status: 'pending', notes: '[TEST] A rechazar',
  }).select('id').single();
  if (reqRej) track('requests', reqRej.id);

  const stockSnap = (await db.from('resources').select('initial_quantity').eq('id', resB.id).single()).data?.initial_quantity;

  await db.from('requests').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', reqRej!.id);
  await db.from('activity_logs').insert({
    action: 'request_rejected', entity_type: 'request', entity_id: reqRej!.id,
    user_id: ADMIN_ID, details: { reason: 'Test rechazo' },
  });

  const stockSnapAfter = (await db.from('resources').select('initial_quantity').eq('id', resB.id).single()).data?.initial_quantity;
  assert(stockSnapAfter === stockSnap, `Stock sin cambios tras rechazo (${stockSnap}→${stockSnapAfter})`);

  const reqsRej = await requestsPanel(ORG_ID);
  assert(reqsRej.some((r: any) => r.id === reqRej?.id && r.status === 'rejected'),
    'Solicitud rechazada aparece en panel Solicitudes con status=rejected');

  // Activity log de rechazo registrado
  const { data: rejLog } = await db.from('activity_logs')
    .select('action').eq('entity_id', reqRej!.id).eq('action', 'request_rejected').limit(1);
  assert((rejLog?.length ?? 0) > 0, 'Activity log request_rejected registrado');

  // ══════════════════════════════════════════════════════════════════════════
  // 9. DEVOLUCIÓN: loan → returned → unidad available → Dashboard actualiza
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('9. Devolución → Loans → Dashboard → Reports'));

  const dashBefore = await dashboardLoans(ORG_ID);
  const activeBefore = dashBefore.active;

  // Devolver el préstamo
  await db.from('loans').update({
    status: 'returned', return_date: today,
  }).eq('id', loan.id);
  await db.from('resource_units').update({ status: 'available' }).eq('id', unitId);
  await db.from('activity_logs').insert({
    action: 'loan_returned', entity_type: 'loan', entity_id: loan.id,
    user_id: ADMIN_ID, details: { unit_id: unitId },
  });

  // Dashboard: loan activo baja en 1
  const dashAfter = await dashboardLoans(ORG_ID);
  assert(dashAfter.active <= activeBefore, `Dashboard: activos bajó (${activeBefore}→${dashAfter.active})`);

  // Unidad vuelve a available
  const { data: unitBack } = await db.from('resource_units').select('status').eq('id', unitId).single();
  assert(unitBack?.status === 'available', `Unidad vuelve a available (${unitBack?.status})`);

  // MyResources: préstamo ya no aparece activo
  const myRes3 = await myResourcesPanel(USER_ID);
  const stillActive = myRes3.loans.find((l: any) => l.id === loan.id);
  assert(!stillActive, 'Préstamo devuelto ya no aparece en MyResources (activos)');

  // Reports: préstamo devuelto contabilizado
  const reportsFinal = await reportsPanel(ORG_ID);
  assert(reportsFinal.returned >= 1, `Reports muestra ≥1 préstamo devuelto (${reportsFinal.returned})`);

  // Panel Loans: préstamo tiene status=returned
  const userLoansFinal = await loansPanel(USER_ID);
  const returnedLoan = userLoansFinal.find((l: any) => l.id === loan.id);
  assert(returnedLoan?.status === 'returned', 'Préstamo en panel Loans = returned');

  // ══════════════════════════════════════════════════════════════════════════
  // 10. RESERVAS: request con fecha futura aparece en panel Reservas
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('10. Panel Reservas'));

  const futureFrom  = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const futureUntil = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

  const { data: reqReserv } = await db.from('requests').insert({
    user_id: USER_ID, organization_id: ORG_ID, resource_id: resA.id,
    quantity: 1, urgency: 'normal', status: 'approved',
    needed_from: futureFrom, needed_until: futureUntil,
    notes: '[TEST] Reserva futura',
  }).select('id').single();

  assert(!!reqReserv, 'Solicitud futura (reserva) creada');
  if (reqReserv) track('requests', reqReserv.id);

  const reservas = await reservationsPanel(ORG_ID);
  const foundReserv = reservas.find((r: any) => r.id === reqReserv?.id);
  assert(!!foundReserv, 'Reserva futura aparece en panel Reservas');
  assert(foundReserv?.needed_from === futureFrom, `Fecha inicio correcta (${foundReserv?.needed_from})`);
  assert(foundReserv?.status === 'approved', `Status = approved (${foundReserv?.status})`);

  // Solicitud pasada NO debe aparecer en Reservas
  const { data: reqPast } = await db.from('requests').insert({
    user_id: USER_ID, organization_id: ORG_ID, resource_id: resA.id,
    quantity: 1, urgency: 'normal', status: 'approved',
    needed_from: '2024-01-01', needed_until: '2024-01-02', notes: '[TEST] Pasada',
  }).select('id').single();
  if (reqPast) track('requests', reqPast.id);

  const reservasCheck = await reservationsPanel(ORG_ID);
  assert(!reservasCheck.some((r: any) => r.id === reqPast?.id),
    'Solicitud pasada NO aparece en panel Reservas');

  // ══════════════════════════════════════════════════════════════════════════
  // 11. ACTIVITY LOG: verifica trazabilidad completa
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('11. Trazabilidad: activity log completo'));

  // Collect all entity IDs used during the test
  const testEntityIds = [resA.id, resB.id, reqReu!.id, reqRej!.id, loan.id];
  const { data: allLogs } = await db.from('activity_logs')
    .select('action').in('entity_id', testEntityIds);

  const actions = (allLogs ?? []).map((l: any) => l.action);
  const expectedActions = ['request_approved', 'stock_allocated', 'consumable_checkout', 'request_rejected', 'loan_returned'];

  for (const action of expectedActions) {
    assert(actions.includes(action), `Activity log contiene: ${action}`);
  }

  // Dashboard: activity reciente incluye nuestros eventos
  const activity = await dashboardActivity(ORG_ID);
  assert(activity.length >= 1, `Dashboard muestra actividad reciente (${activity.length} eventos)`);

  // ══════════════════════════════════════════════════════════════════════════
  // 12. REPORTS: datos cruzados de loans + consumables
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('12. Panel Reports — datos cruzados'));

  // Préstamos devueltos (nuestro loan ya fue devuelto)
  const { data: returnedLoans } = await db.from('loans')
    .select('id, status, resource_units(resource_id)')
    .eq('status', 'returned').eq('id', loan.id);
  assert((returnedLoans?.length ?? 0) === 1, 'Préstamo devuelto incluido en datos de Reports');

  // Consumables por recurso
  const { data: consumableLogs } = await db.from('activity_logs')
    .select('details').eq('action', 'stock_allocated').eq('entity_id', resB.id);
  const totalConsumed = (consumableLogs ?? []).reduce((sum: number, l: any) => sum + (l.details?.quantity ?? 0), 0);
  assert(totalConsumed >= 5, `Reports: total consumido por recurso B = ${totalConsumed} (≥5)`);

  // ══════════════════════════════════════════════════════════════════════════
  // 13. CLEANUP
  // ══════════════════════════════════════════════════════════════════════════
  console.log(sec('13. Cleanup'));

  // Restaurar departamento del usuario
  await db.from('profiles').update({ department_id: null }).eq('id', USER_ID);

  // Eliminar en orden FK
  const requestIds = cleanup.filter(x => x.table === 'requests').map(x => x.val);
  if (requestIds.length > 0) {
    await db.from('loans').delete().in('request_id', requestIds);
    await db.from('requests').delete().in('id', requestIds);
  }

  const loanIds = cleanup.filter(x => x.table === 'loans').map(x => x.val);
  if (loanIds.length > 0) await db.from('loans').delete().in('id', loanIds);

  const unitIds2 = cleanup.filter(x => x.table === 'resource_units').map(x => x.val);
  if (unitIds2.length > 0) await db.from('resource_units').delete().in('id', unitIds2);

  const resourceIds2 = cleanup.filter(x => x.table === 'resources').map(x => x.val);
  if (resourceIds2.length > 0) {
    // Delete activity logs for resources + any request/loan logs created during test
    const allTestEntityIds = [...resourceIds2];
    if (reqReu) allTestEntityIds.push(reqReu.id);
    if (reqRej) allTestEntityIds.push(reqRej.id);
    if (loan) allTestEntityIds.push(loan.id);
    await db.from('activity_logs').delete().in('entity_id', allTestEntityIds);
    await db.from('resource_condition_tags').delete().in('resource_id', resourceIds2);
    await db.from('resources').delete().in('id', resourceIds2);
  }

  const deptIds = cleanup.filter(x => x.table === 'departments').map(x => x.val);
  if (deptIds.length > 0) {
    await db.from('department_managers').delete().in('department_id', deptIds);
    await db.from('departments').delete().in('id', deptIds);
  }

  const locIds = cleanup.filter(x => x.table === 'locations').map(x => x.val);
  if (locIds.length > 0) {
    await db.from('location_managers').delete().in('location_id', locIds);
    await db.from('locations').delete().in('id', locIds);
  }

  const invIds = cleanup.filter(x => x.table === 'invitations').map(x => x.val);
  if (invIds.length > 0) await db.from('invitations').delete().in('id', invIds);

  // Verificar limpieza
  const { data: leftover } = await db.from('resources')
    .select('id').in('id', resourceIds2);
  assert((leftover?.length ?? 0) === 0, 'Recursos de test eliminados');

  const { data: leftoverDepts } = await db.from('departments')
    .select('id').in('id', deptIds);
  assert((leftoverDepts?.length ?? 0) === 0, 'Departamentos de test eliminados');

  // ─── Resumen ─────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  Total: ${total}   \x1b[32mPasaron: ${passed}\x1b[0m   \x1b[31mFallaron: ${failed}\x1b[0m`);
  console.log('═'.repeat(55));

  if (failed > 0) { console.log(fail(`${failed} test(s) fallaron.\n`)); process.exit(1); }
  else            { console.log(ok('Todos los tests de paneles pasaron.\n')); }
}

run().catch(err => { console.error('\nError inesperado:', err); process.exit(1); });
