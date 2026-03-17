/**
 * Test de integración completo — InvTrack
 *
 * Prueba la interacción entre roles (admin, aprobador, usuario), tipos de
 * recursos (reutilizable, gastable, instalado, servicio), propiedades
 * (visibilidad, departamento, ubicación, etiquetas) y flujos completos
 * (solicitud → aprobación → préstamo → devolución → rechazo).
 *
 * Uso:
 *   npm run test:integration
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

// ─── Consola ─────────────────────────────────────────────────────────────────
const green  = (s: string) => `\x1b[32m✓ ${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m✗ ${s}\x1b[0m`;
const cyan   = (s: string) => `\x1b[36m  ${s}\x1b[0m`;
const bold   = (s: string) => `\n\x1b[1m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m  ⚠ ${s}\x1b[0m`;

let passed = 0; let failed = 0;

function assert(ok: boolean, label: string, detail?: string) {
  if (ok) { console.log(green(label)); passed++; }
  else    { console.log(red(label) + (detail ? `  → ${detail}` : '')); failed++; }
}

// ─── Helpers de DB ───────────────────────────────────────────────────────────

async function fetchResource(id: string) {
  const { data } = await db.from('resources')
    .select('id, initial_quantity, warehouse_quantity, status, behavior, type, catalog_visibility, ownership_type, owner_user_id, department_id, location_id')
    .eq('id', id).single();
  return data;
}

async function fetchRequest(id: string) {
  const { data } = await db.from('requests')
    .select('id, status, quantity, resource_id, user_id').eq('id', id).single();
  return data;
}

async function fetchLoans(requestId: string) {
  const { data } = await db.from('loans')
    .select('id, unit_id, user_id, status').eq('request_id', requestId);
  return data ?? [];
}

async function fetchUnits(resourceId: string) {
  const { data } = await db.from('resource_units')
    .select('id, serial_number, status').eq('resource_id', resourceId);
  return data ?? [];
}

/** Replica allocateAndCreateLoans para reutilizables */
async function approveReusable(
  req: { id: string; resource_id: string; quantity: number; user_id: string; organization_id: string }
) {
  const { data: units } = await db.from('resource_units')
    .select('id').eq('resource_id', req.resource_id).eq('status', 'available').limit(req.quantity);
  if (!units || units.length < req.quantity)
    return { error: `Solo ${units?.length ?? 0} unidades disponibles, se pidieron ${req.quantity}` };

  for (const unit of units) {
    const { error: loanErr } = await db.from('loans').insert({
      unit_id: unit.id, user_id: req.user_id, request_id: req.id,
      organization_id: req.organization_id,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'active',
    });
    if (loanErr) return { error: loanErr.message };
    await db.from('resource_units').update({ status: 'on_loan' }).eq('id', unit.id);
  }
  await db.from('requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', req.id);
  return { ok: true };
}

/** Replica allocateAndCreateLoans para consumibles (gastable) */
async function approveConsumable(
  req: { id: string; resource_id: string; quantity: number; user_id: string }
) {
  const { data: res } = await db.from('resources')
    .select('initial_quantity').eq('id', req.resource_id).single();
  const stock = res?.initial_quantity ?? 0;
  if (stock < req.quantity) return { error: `Stock insuficiente: ${stock} < ${req.quantity}` };

  const newStock = stock - req.quantity;
  const { error } = await db.from('resources').update({
    initial_quantity: newStock,
    status: newStock > 0 ? 'available' : 'inactive',
  }).eq('id', req.resource_id);
  if (error) return { error: error.message };

  await db.from('activity_logs').insert({
    action: 'stock_allocated', entity_type: 'resource', entity_id: req.resource_id,
    user_id: req.user_id,
    details: { quantity: req.quantity, remaining_stock: newStock },
  });
  await db.from('requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', req.id);
  return { ok: true, newStock };
}

/** Devuelve un préstamo: unidad → available, loan → returned */
async function returnLoan(loanId: string, unitId: string) {
  await db.from('resource_units').update({ status: 'available' }).eq('id', unitId);
  const { error } = await db.from('loans')
    .update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] }).eq('id', loanId);
  return error ? { error: error.message } : { ok: true };
}

/** Rechaza una solicitud (sin tocar stock ni unidades) */
async function rejectRequest(requestId: string) {
  const { error } = await db.from('requests')
    .update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', requestId);
  return error ? { error: error.message } : { ok: true };
}

/** isVisibleInCatalog — replica de resourceVisibility.ts */
function isVisibleInCatalog(
  resource: { catalog_visibility?: string | null; ownership_type?: string | null; owner_user_id?: string | null },
  canSeeAll: boolean,
  userId?: string | null
): boolean {
  const v = resource.catalog_visibility;
  const visibility = (v === 'public' || v === 'restricted' || v === 'internal')
    ? v
    : resource.ownership_type === 'personal' || resource.ownership_type === 'area'
      ? 'restricted' : 'public';

  if (canSeeAll) return true;
  if (visibility === 'public') return true;
  if (visibility === 'restricted')
    return !!(userId && resource.owner_user_id && resource.owner_user_id === userId);
  return false;
}

// IDs de objetos creados durante el test (para cleanup)
const createdIds: { table: string; id: string }[] = [];
function track(table: string, id: string) { createdIds.push({ table, id }); }

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\x1b[1m\n=== Test Integración InvTrack — Roles · Tipos · Propiedades · Flujos ===\x1b[0m\n');

  // ══════════════════════════════════════════════════════════════════════════
  // 0. CONTEXTO: org, perfiles, categoría, ubicación, departamento
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('0. Contexto'));

  // Buscar la org que tenga miembros activos
  const { data: memberships } = await db.from('organization_memberships')
    .select('organization_id, user_id, role')
    .eq('status', 'active')
    .limit(20);

  if (!memberships || memberships.length === 0) {
    console.error('No hay memberships activos. Crea usuarios desde la app.'); process.exit(1);
  }

  // Usar la org con más miembros
  const orgCounts: Record<string, number> = {};
  memberships.forEach(m => { orgCounts[m.organization_id] = (orgCounts[m.organization_id] ?? 0) + 1; });
  const topOrgId = Object.entries(orgCounts).sort((a, b) => b[1] - a[1])[0][0];

  const { data: orgs } = await db.from('organizations').select('id, name').eq('id', topOrgId).limit(1);
  const org = orgs?.[0];
  if (!org) { console.error('No hay organización con miembros.'); process.exit(1); }
  console.log(cyan(`Org: ${org.name} (${org.id})`));

  // Perfiles de esta org via memberships
  const orgMemberships = memberships.filter(m => m.organization_id === org.id);
  const { data: allProfiles } = await db.from('profiles')
    .select('id, full_name, role_name')
    .in('id', orgMemberships.map(m => m.user_id));

  if (!allProfiles || allProfiles.length === 0) {
    console.error('No hay perfiles en la organización.'); process.exit(1);
  }

  // Enriquecer perfiles con su membership_role
  const profiles = allProfiles.map(p => ({
    ...p,
    role: orgMemberships.find(m => m.user_id === p.id)?.role ?? 'member',
  }));

  // Asignar roles: owner/admin = canSeeAll; member = usuario normal
  const adminProfile    = profiles.find(p => p.role === 'owner' || p.role === 'admin') ?? profiles[0];
  const approverProfile = profiles.find(p => p.role === 'approver') ?? adminProfile;
  const userProfile     = profiles.find(p => p.role === 'member') ?? profiles[profiles.length - 1];

  console.log(cyan(`Admin:     ${adminProfile.full_name} (${adminProfile.role})`));
  console.log(cyan(`Aprobador: ${approverProfile.full_name} (${approverProfile.role})`));
  console.log(cyan(`Usuario:   ${userProfile.full_name} (${userProfile.role})`));

  if (adminProfile.id === userProfile.id)
    console.log(yellow('Admin y usuario son el mismo perfil — algunos tests de visibilidad serán más permisivos'));

  // Categoría, ubicación, departamento
  const { data: cats } = await db.from('categories').select('id, name').eq('organization_id', org.id).limit(1);
  const cat = cats?.[0] ?? null;

  const { data: locs } = await db.from('locations').select('id, name').eq('organization_id', org.id).limit(1);
  const loc = locs?.[0] ?? null;

  const { data: depts } = await db.from('departments').select('id, name').eq('organization_id', org.id).limit(1);
  const dept = depts?.[0] ?? null;

  console.log(cyan(`Categoría: ${cat?.name ?? 'ninguna'} | Ubicación: ${loc?.name ?? 'ninguna'} | Depto: ${dept?.name ?? 'ninguno'}`));

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CREAR RECURSOS DE CADA TIPO
  // ══════════════════════════════════════════════════════════════════════════
  const ts = Date.now();

  // ── 1a. Reutilizable / Prestable ─────────────────────────────────────────
  console.log(bold('1a. Recurso reutilizable (prestable, public)'));

  const { data: resReutilizable, error: errReu } = await db.from('resources').insert({
    name: `[TEST] Laptop reutilizable ${ts}`,
    sku:  `TEST-REU-${ts}`,
    type: 'reusable', behavior: 'prestable',
    initial_quantity: 3, warehouse_quantity: 0,
    catalog_visibility: 'public', ownership_type: 'general',
    department_id: dept?.id ?? null, location_id: loc?.id ?? null,
    category_id: cat?.id ?? null,
    organization_id: org.id, status: 'available',
    requires_approval: true,
  }).select().single();

  if (errReu || !resReutilizable) { console.error('Error creando reutilizable:', errReu?.message); process.exit(1); }
  track('resources', resReutilizable.id);

  // Crear 3 unidades
  for (let i = 1; i <= 3; i++) {
    const { data: unit } = await db.from('resource_units').insert({
      resource_id: resReutilizable.id, organization_id: org.id,
      serial_number: `TEST-LAP-${ts}-${String(i).padStart(3,'0')}`,
      status: 'available', condition: 'new',
    }).select('id').single();
    if (unit) track('resource_units', unit.id);
  }

  assert(resReutilizable.type === 'reusable',           'Tipo = reusable');
  assert(resReutilizable.behavior === 'prestable',       'Behavior = prestable');
  assert(resReutilizable.catalog_visibility === 'public','Visibilidad = public');
  assert(resReutilizable.initial_quantity === 3,         'Cantidad inicial = 3');
  assert(resReutilizable.department_id === (dept?.id ?? null), 'Departamento asignado');
  assert(resReutilizable.location_id   === (loc?.id   ?? null), 'Ubicación asignada');

  // ── 1b. Gastable con stock almacén ───────────────────────────────────────
  console.log(bold('1b. Recurso gastable (consumible, public, con almacén)'));

  const { data: resGastable, error: errGas } = await db.from('resources').insert({
    name: `[TEST] Resmas papel ${ts}`,
    sku:  `TEST-GAS-${ts}`,
    type: 'consumable', behavior: 'gastable',
    initial_quantity: 20, warehouse_quantity: 50,
    catalog_visibility: 'public', ownership_type: 'general',
    department_id: dept?.id ?? null, location_id: loc?.id ?? null,
    category_id: cat?.id ?? null,
    organization_id: org.id, status: 'available',
    requires_approval: true,
  }).select().single();

  if (errGas || !resGastable) { console.error('Error creando gastable:', errGas?.message); process.exit(1); }
  track('resources', resGastable.id);

  assert(resGastable.type === 'consumable',          'Tipo = consumable');
  assert(resGastable.behavior === 'gastable',        'Behavior = gastable');
  assert(resGastable.initial_quantity   === 20,      'Stock público = 20');
  assert(resGastable.warehouse_quantity === 50,      'Stock almacén = 50');

  // ── 1c. Instalado / Fijo ─────────────────────────────────────────────────
  console.log(bold('1c. Recurso instalado (fijo, restricted)'));

  const { data: resInstalado, error: errIns } = await db.from('resources').insert({
    name: `[TEST] Proyector fijo ${ts}`,
    sku:  `TEST-INS-${ts}`,
    type: 'reusable', behavior: 'instalado',
    initial_quantity: 1, warehouse_quantity: 0,
    catalog_visibility: 'restricted', ownership_type: 'area',
    owner_name: 'Sala A',
    department_id: dept?.id ?? null, location_id: loc?.id ?? null,
    category_id: cat?.id ?? null,
    organization_id: org.id, status: 'available',
    requires_approval: false,
  }).select().single();

  if (errIns || !resInstalado) { console.error('Error creando instalado:', errIns?.message); process.exit(1); }
  track('resources', resInstalado.id);

  assert(resInstalado.behavior === 'instalado',           'Behavior = instalado');
  assert(resInstalado.catalog_visibility === 'restricted','Visibilidad = restricted');
  assert(resInstalado.requires_approval === false,        'No requiere aprobación');

  // ── 1d. Servicio / Licencia ───────────────────────────────────────────────
  console.log(bold('1d. Recurso servicio (licencia, internal)'));

  const { data: resServicio, error: errSrv } = await db.from('resources').insert({
    name: `[TEST] Adobe CC ${ts}`,
    sku:  `TEST-SRV-${ts}`,
    type: 'consumable', behavior: 'servicio',
    initial_quantity: 10, warehouse_quantity: 0,
    catalog_visibility: 'internal', ownership_type: 'general',
    department_id: dept?.id ?? null,
    category_id: cat?.id ?? null,
    organization_id: org.id, status: 'available',
    requires_approval: true,
  }).select().single();

  if (errSrv || !resServicio) { console.error('Error creando servicio:', errSrv?.message); process.exit(1); }
  track('resources', resServicio.id);

  assert(resServicio.behavior === 'servicio',           'Behavior = servicio');
  assert(resServicio.catalog_visibility === 'internal', 'Visibilidad = internal');
  assert(resServicio.type === 'consumable',             'Tipo = consumable');

  // ── 1e. Personal (asignado a usuario) ────────────────────────────────────
  console.log(bold('1e. Recurso personal (asignado a usuario específico)'));

  const { data: resPersonal, error: errPer } = await db.from('resources').insert({
    name: `[TEST] MacBook personal ${ts}`,
    sku:  `TEST-PER-${ts}`,
    type: 'reusable', behavior: 'prestable',
    initial_quantity: 1, warehouse_quantity: 0,
    catalog_visibility: 'restricted', ownership_type: 'personal',
    owner_user_id: userProfile.id, owner_name: userProfile.full_name,
    category_id: cat?.id ?? null,
    organization_id: org.id, status: 'available',
    requires_approval: false,
  }).select().single();

  if (errPer || !resPersonal) { console.error('Error creando personal:', errPer?.message); process.exit(1); }
  track('resources', resPersonal.id);

  assert(resPersonal.ownership_type === 'personal',       'Ownership = personal');
  assert(resPersonal.owner_user_id  === userProfile.id,   'Asignado al usuario correcto');
  assert(resPersonal.catalog_visibility === 'restricted', 'Visibilidad = restricted');

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ETIQUETAS DE CONDICIÓN
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('2. Etiquetas de condición'));

  // Reutilizamos o creamos una etiqueta
  let tagId: string | null = null;
  const { data: existingTags } = await db.from('condition_tags')
    .select('id, name').eq('organization_id', org.id).limit(1);

  if (existingTags && existingTags.length > 0) {
    tagId = existingTags[0].id;
    console.log(cyan(`Etiqueta existente: ${existingTags[0].name}`));
  } else {
    const { data: newTag } = await db.from('condition_tags').insert({
      name: 'Buen estado', color: 'green', organization_id: org.id,
    }).select('id').single();
    tagId = newTag?.id ?? null;
    if (tagId) track('condition_tags', tagId);
    console.log(cyan('Etiqueta creada: Buen estado'));
  }

  if (tagId) {
    const { error: tagLinkErr } = await db.from('resource_condition_tags').insert({
      resource_id: resReutilizable.id, tag_id: tagId,
    });
    track('resource_condition_tags', `${resReutilizable.id}:${tagId}`);

    const { data: linked } = await db.from('resource_condition_tags')
      .select('tag_id').eq('resource_id', resReutilizable.id).eq('tag_id', tagId);

    assert(!tagLinkErr,           'Etiqueta vinculada sin error');
    assert((linked?.length ?? 0) === 1, 'Etiqueta aparece en el recurso');
  } else {
    console.log(yellow('Sin etiquetas disponibles, se omite este test'));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. VISIBILIDAD POR ROL
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('3. Visibilidad por rol'));

  // Admin ve todo
  assert(
    isVisibleInCatalog(resReutilizable, true),
    'Admin ve recurso public'
  );
  assert(
    isVisibleInCatalog(resInstalado, true),
    'Admin ve recurso restricted'
  );
  assert(
    isVisibleInCatalog(resServicio, true),
    'Admin ve recurso internal'
  );
  assert(
    isVisibleInCatalog(resPersonal, true),
    'Admin ve recurso personal'
  );

  // Usuario normal
  assert(
    isVisibleInCatalog(resReutilizable, false, userProfile.id),
    'Usuario ve recurso public'
  );
  assert(
    !isVisibleInCatalog(resInstalado, false, userProfile.id),
    'Usuario NO ve restricted sin ser el asignado'
  );
  assert(
    !isVisibleInCatalog(resServicio, false, userProfile.id),
    'Usuario NO ve internal'
  );
  assert(
    isVisibleInCatalog(resPersonal, false, userProfile.id),
    'Usuario ve su propio recurso personal (owner_user_id coincide)'
  );
  assert(
    !isVisibleInCatalog(resPersonal, false, adminProfile.id === userProfile.id ? 'otro-usuario-id' : adminProfile.id),
    'Otro usuario NO ve recurso personal ajeno'
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. FLUJO REUTILIZABLE: solicitar → aprobar → préstamos → devolver
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('4. Flujo reutilizable: solicitar → aprobar → devolver'));

  const { data: reqReu, error: errReqReu } = await db.from('requests').insert({
    user_id: userProfile.id, organization_id: org.id,
    resource_id: resReutilizable.id, quantity: 2,
    urgency: 'normal', status: 'pending',
    notes: '[TEST] Solicitud reutilizable',
  }).select('id, status, quantity').single();

  assert(!errReqReu && !!reqReu, 'Solicitud reutilizable creada');
  if (!reqReu) { console.error('No se pudo crear la solicitud.'); process.exit(1); }
  track('requests', reqReu.id);

  // Estado inicial: pendiente
  assert(reqReu.status === 'pending', 'Estado inicial = pending');

  // Aprobar (simula al aprobador)
  const approvalReu = await approveReusable({
    id: reqReu.id, resource_id: resReutilizable.id,
    quantity: 2, user_id: userProfile.id, organization_id: org.id,
  });
  assert(!('error' in approvalReu), 'Aprobación sin error', 'error' in approvalReu ? approvalReu.error : undefined);

  const reqReuAfter = await fetchRequest(reqReu.id);
  assert(reqReuAfter?.status === 'approved', 'Solicitud → approved');

  // Verificar préstamos y unidades
  const loans = await fetchLoans(reqReu.id);
  assert(loans.length === 2, `Se crearon 2 préstamos  (obtenidos: ${loans.length})`);
  assert(loans.every(l => l.status === 'active'), 'Todos los préstamos = active');

  const units = await fetchUnits(resReutilizable.id);
  const onLoan = units.filter(u => u.status === 'on_loan');
  assert(onLoan.length === 2, `2 unidades en on_loan  (obtenidas: ${onLoan.length})`);

  const available = units.filter(u => u.status === 'available');
  assert(available.length === 1, `1 unidad sigue disponible  (obtenidas: ${available.length})`);

  // Almacén de reutilizable no existe / es 0
  const resReuDB = await fetchResource(resReutilizable.id);
  assert((resReuDB?.warehouse_quantity ?? 0) === 0, 'warehouse_quantity=0 para reutilizable (no aplica)');

  // Devolver los 2 préstamos
  for (const loan of loans) {
    const ret = await returnLoan(loan.id, loan.unit_id);
    assert(!('error' in ret), `Préstamo ${loan.id.slice(0,8)}… devuelto`);
  }

  const unitsAfterReturn = await fetchUnits(resReutilizable.id);
  assert(
    unitsAfterReturn.every(u => u.status === 'available'),
    `Todas las unidades vuelven a available  (${unitsAfterReturn.map(u=>u.status).join(', ')})`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 5. FLUJO GASTABLE: solicitar → aprobar → stock baja, almacén intacto
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('5. Flujo gastable: solicitar → aprobar → stock público baja'));

  const { data: reqGas, error: errReqGas } = await db.from('requests').insert({
    user_id: userProfile.id, organization_id: org.id,
    resource_id: resGastable.id, quantity: 5,
    urgency: 'normal', status: 'pending',
    notes: '[TEST] Solicitud gastable',
  }).select('id, status').single();

  assert(!errReqGas && !!reqGas, 'Solicitud gastable creada');
  if (!reqGas) { console.error('No se pudo crear solicitud gastable.'); process.exit(1); }
  track('requests', reqGas.id);

  const approvalGas = await approveConsumable({
    id: reqGas.id, resource_id: resGastable.id,
    quantity: 5, user_id: approverProfile.id,
  });
  assert(!('error' in approvalGas), 'Aprobación gastable sin error');

  const resGasAfter = await fetchResource(resGastable.id);
  assert(resGasAfter?.initial_quantity   === 15, `Stock público 20-5=15  (obtenido: ${resGasAfter?.initial_quantity})`);
  assert(resGasAfter?.warehouse_quantity === 50, `Almacén intacto=50      (obtenido: ${resGasAfter?.warehouse_quantity})`);
  assert(resGasAfter?.status === 'available',    `Status=available (stock>0)  (obtenido: ${resGasAfter?.status})`);

  // Gastable no crea loans ni mueve unidades
  const loansGas = await fetchLoans(reqGas.id);
  assert(loansGas.length === 0, `Gastable NO crea loans  (creados: ${loansGas.length})`);

  // Verificar activity log
  const { data: gasLogs } = await db.from('activity_logs')
    .select('action, details').eq('entity_id', resGastable.id).eq('action', 'stock_allocated').limit(1);
  assert((gasLogs?.length ?? 0) > 0, 'Activity log stock_allocated registrado');
  assert(gasLogs?.[0]?.details?.quantity === 5, `Log registra quantity=5  (obtenido: ${gasLogs?.[0]?.details?.quantity})`);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. FLUJO RECHAZO: solicitud rechazada → stock sin cambios
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('6. Flujo rechazo: solicitud rechazada sin tocar stock'));

  const { data: reqRej, error: errRej } = await db.from('requests').insert({
    user_id: userProfile.id, organization_id: org.id,
    resource_id: resGastable.id, quantity: 8,
    urgency: 'normal', status: 'pending',
    notes: '[TEST] Solicitud a rechazar',
  }).select('id').single();

  assert(!errRej && !!reqRej, 'Solicitud a rechazar creada');
  if (!reqRej) { console.error('Fallo creando solicitud a rechazar.'); process.exit(1); }
  track('requests', reqRej.id);

  const rejection = await rejectRequest(reqRej.id);
  assert(!('error' in rejection), 'Rechazo sin error');

  const reqRejAfter = await fetchRequest(reqRej.id);
  assert(reqRejAfter?.status === 'rejected', 'Estado = rejected');

  const resGasAfterRej = await fetchResource(resGastable.id);
  assert(resGasAfterRej?.initial_quantity === 15, `Stock sin cambios tras rechazo (sigue 15, obtenido: ${resGasAfterRej?.initial_quantity})`);

  const loansRej = await fetchLoans(reqRej.id);
  assert(loansRej.length === 0, 'Rechazo no crea préstamos');

  // ══════════════════════════════════════════════════════════════════════════
  // 7. GASTABLE: agotar stock público → status inactive
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('7. Gastable: agotar stock público → status inactive'));

  // Ajustamos el stock a exactamente 5 para vaciarlo fácilmente
  await db.from('resources').update({ initial_quantity: 5, status: 'available' }).eq('id', resGastable.id);

  const { data: reqExhaust } = await db.from('requests').insert({
    user_id: userProfile.id, organization_id: org.id,
    resource_id: resGastable.id, quantity: 5,
    urgency: 'normal', status: 'pending', notes: '[TEST] Agotar stock',
  }).select('id').single();

  if (reqExhaust) {
    track('requests', reqExhaust.id);
    const approvalEx = await approveConsumable({
      id: reqExhaust.id, resource_id: resGastable.id,
      quantity: 5, user_id: approverProfile.id,
    });
    const resExhaust = await fetchResource(resGastable.id);
    assert(!('error' in approvalEx),         'Aprobación que agota stock sin error');
    assert(resExhaust?.initial_quantity === 0,'Stock público = 0 tras agotar');
    assert(resExhaust?.status === 'inactive', `Status = inactive cuando stock=0  (obtenido: ${resExhaust?.status})`);
    assert(resExhaust?.warehouse_quantity === 50, 'Almacén (50) intacto aunque stock público sea 0');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. STOCK INSUFICIENTE: intentar aprobar más de lo disponible
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('8. Solicitud con stock insuficiente'));

  // Intentar aprobar 100 con stock=0
  const overReq = await approveConsumable({
    id: 'fake-id', resource_id: resGastable.id,
    quantity: 100, user_id: approverProfile.id,
  });
  assert('error' in overReq, `Error al aprobar más de lo disponible  (${('error' in overReq) ? overReq.error : 'sin error'})`);

  // Reutilizable: pedir más unidades de las disponibles
  const overReusable = await approveReusable({
    id: 'fake-id', resource_id: resReutilizable.id,
    quantity: 99, user_id: userProfile.id, organization_id: org.id,
  });
  assert('error' in overReusable, 'Error al pedir más unidades de las disponibles');

  // ══════════════════════════════════════════════════════════════════════════
  // 9. DEPARTAMENTO Y UBICACIÓN: persisten correctamente
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('9. Propiedades: departamento y ubicación'));

  const resReuDB2 = await fetchResource(resReutilizable.id);
  assert(resReuDB2?.department_id === (dept?.id ?? null), `Departamento correcto  (obtenido: ${resReuDB2?.department_id})`);
  assert(resReuDB2?.location_id   === (loc?.id   ?? null), `Ubicación correcta     (obtenido: ${resReuDB2?.location_id})`);

  // Filtrar recursos por departamento (simula búsqueda admin)
  if (dept?.id) {
    const { data: byDept } = await db.from('resources')
      .select('id').eq('organization_id', org.id).eq('department_id', dept.id);
    const ourIds = [resReutilizable.id, resGastable.id, resInstalado.id, resServicio.id];
    const found = (byDept ?? []).filter(r => ourIds.includes(r.id));
    assert(found.length >= 3, `Recursos del depto encontrados en filtro  (encontrados: ${found.length}/4)`);
  } else {
    console.log(yellow('Sin departamento disponible, test de filtrado omitido'));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. TRANSFERENCIA ALMACÉN → CATÁLOGO (post-agotamiento)
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('10. Transferir almacén al catálogo tras agotar stock público'));

  const gasNow = await fetchResource(resGastable.id);
  const warehouse = gasNow?.warehouse_quantity ?? 0;
  assert(warehouse === 50, `Almacén aún tiene 50 unidades  (obtenido: ${warehouse})`);

  // Transferir 20 del almacén
  const newPublic    = (gasNow?.initial_quantity ?? 0) + 20;
  const newWarehouse = warehouse - 20;
  const { error: transferErr } = await db.from('resources').update({
    initial_quantity:   newPublic,
    warehouse_quantity: newWarehouse,
    status: newPublic > 0 ? 'available' : 'inactive',
  }).eq('id', resGastable.id);

  const gasAfterTransfer = await fetchResource(resGastable.id);
  assert(!transferErr,                                  'Transferencia sin error');
  assert(gasAfterTransfer?.initial_quantity   === 20,  `Stock público repuesto a 20  (obtenido: ${gasAfterTransfer?.initial_quantity})`);
  assert(gasAfterTransfer?.warehouse_quantity === 30,  `Almacén bajó a 30           (obtenido: ${gasAfterTransfer?.warehouse_quantity})`);
  assert(gasAfterTransfer?.status === 'available',     `Status = available tras reponer  (obtenido: ${gasAfterTransfer?.status})`);

  // ══════════════════════════════════════════════════════════════════════════
  // 11. INSTALADO: no genera préstamos, visibilidad restricted
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('11. Recurso instalado: no se presta, restringido'));

  const resInstDB = await fetchResource(resInstalado.id);
  assert(resInstDB?.behavior === 'instalado',           'Behavior instalado persiste');
  assert(resInstDB?.catalog_visibility === 'restricted','Visibilidad restricted');
  assert(!isVisibleInCatalog(resInstDB!, false, userProfile.id), 'Usuario común NO ve instalado sin ser asignado');
  assert( isVisibleInCatalog(resInstDB!, true),         'Admin SÍ ve instalado');

  // ══════════════════════════════════════════════════════════════════════════
  // 12. SERVICIO: solo visible para admin (internal)
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('12. Recurso servicio: solo admin lo ve'));

  const resSrvDB = await fetchResource(resServicio.id);
  assert(resSrvDB?.catalog_visibility === 'internal', 'Visibilidad internal');
  assert( isVisibleInCatalog(resSrvDB!, true),        'Admin ve servicio internal');
  assert(!isVisibleInCatalog(resSrvDB!, false),       'Usuario NO ve servicio internal');
  assert(resSrvDB?.type === 'consumable',             'Servicio es tipo consumable');

  // ══════════════════════════════════════════════════════════════════════════
  // 13. RECURSO PERSONAL: solo visible al asignado
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('13. Recurso personal: solo visible al propietario'));

  const resPerDB = await fetchResource(resPersonal.id);
  assert(resPerDB?.ownership_type === 'personal',       'Ownership = personal');
  assert(resPerDB?.owner_user_id  === userProfile.id,   'owner_user_id = usuario correcto');
  assert( isVisibleInCatalog(resPerDB!, false, userProfile.id), 'Propietario ve su recurso personal');
  const otroId = adminProfile.id === userProfile.id ? 'otro-id-ficticio' : adminProfile.id;
  assert(!isVisibleInCatalog(resPerDB!, false, otroId), 'Otro usuario NO ve recurso personal ajeno');
  assert( isVisibleInCatalog(resPerDB!, true),          'Admin ve recurso personal ajeno (canSeeAll)');

  // ══════════════════════════════════════════════════════════════════════════
  // 14. CLEANUP
  // ══════════════════════════════════════════════════════════════════════════
  console.log(bold('14. Cleanup'));

  // Eliminar en orden (FK: loans → requests → resource_units → condition_tags → resources)
  const requestIds = createdIds.filter(x => x.table === 'requests').map(x => x.id);
  if (requestIds.length > 0) {
    await db.from('loans').delete().in('request_id', requestIds);
    await db.from('requests').delete().in('id', requestIds);
  }

  const unitIds = createdIds.filter(x => x.table === 'resource_units').map(x => x.id);
  if (unitIds.length > 0) await db.from('resource_units').delete().in('id', unitIds);

  const resourceIds = createdIds.filter(x => x.table === 'resources').map(x => x.id);
  if (resourceIds.length > 0) {
    await db.from('activity_logs').delete().in('entity_id', resourceIds);
    await db.from('resource_condition_tags').delete().in('resource_id', resourceIds);
    await db.from('resources').delete().in('id', resourceIds);
  }

  const { data: remaining } = await db.from('resources').select('id').in('id', resourceIds);
  assert((remaining?.length ?? 0) === 0, 'Todos los recursos de test eliminados');

  // ── Resumen ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Total: ${total}   \x1b[32mPasaron: ${passed}\x1b[0m   \x1b[31mFallaron: ${failed}\x1b[0m`);
  console.log('═'.repeat(50));

  if (failed > 0) {
    console.log(red(`${failed} test(s) fallaron.\n`));
    process.exit(1);
  } else {
    console.log(green(`Todos los tests pasaron.\n`));
  }
}

run().catch(err => { console.error('\nError inesperado:', err); process.exit(1); });
