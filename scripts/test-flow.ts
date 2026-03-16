/**
 * Script para probar y mejorar el flujo: ver recurso → solicitar → aprobar → préstamos.
 * Soporta recursos con múltiples unidades (ej: 5 iPads #1–#5).
 *
 * Uso:
 *   npm run test:flow        # Prueba con datos existentes
 *   npm run test:flow:seed   # Crea recurso "iPad" y 5 unidades y luego prueba
 *
 * Variables de entorno (.env.local):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (obligatorias para la app)
 *   SUPABASE_SERVICE_ROLE_KEY                  (obligatoria para este script; RLS oculta datos con anon)
 */

import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cargar .env.local (Vite) o .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('');
  console.error('Este script necesita SUPABASE_SERVICE_ROLE_KEY en .env.local');
  console.error('(con la clave anon, RLS impide leer organizaciones y el script no puede continuar).');
  console.error('');
  console.error('Pasos:');
  console.error('  1. Entra en Supabase → tu proyecto Inv-Track → Settings → API');
  console.error('  2. Copia la clave "service_role" (secret)');
  console.error('  3. En la raíz del proyecto, añade en .env.local:');
  console.error('     SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  console.error('  4. Vuelve a ejecutar: npm run test:flow');
  console.error('');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Copia mínima de allocateAndCreateLoans para no depender de import.meta
async function allocateAndCreateLoans(
  client: SupabaseClient,
  req: {
    id: string;
    resource_id?: string;
    resources?: { name?: string };
    organization_id?: string;
    user_id?: string;
    profiles?: { id?: string };
    quantity?: number;
  },
  currentUserId: string
): Promise<void> {
  const quantity = req.quantity ?? 1;
  const resourceId = req.resource_id ?? (req as any).resources?.id;
  if (!resourceId) throw new Error('No se pudo identificar el recurso');

  let orgId = req.organization_id;
  if (!orgId) {
    const { data: profile } = await client.from('profiles').select('organization_id').eq('id', currentUserId).single();
    orgId = profile?.organization_id ?? undefined;
  }
  if (!orgId) throw new Error('No se pudo determinar la organización');

  const { data: units, error: unitsErr } = await client
    .from('resource_units')
    .select('id, status')
    .eq('resource_id', resourceId)
    .eq('status', 'available')
    .limit(quantity);
  if (unitsErr) throw unitsErr;
  const selected = units ?? [];
  if (selected.length < quantity) throw new Error(`Solo hay ${selected.length} unidades disponibles (se pidieron ${quantity})`);

  const start = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const borrower = req.user_id ?? req.profiles?.id ?? currentUserId;

  for (const unit of selected) {
    const { error: insErr } = await client.from('loans').insert({
      unit_id: unit.id,
      user_id: borrower,
      request_id: req.id,
      organization_id: orgId,
      start_date: start,
      due_date: due,
      status: 'active',
    });
    if (insErr) throw new Error(insErr.message);
    const { error: upErr } = await client.from('resource_units').update({ status: 'on_loan' }).eq('id', unit.id);
    if (upErr) throw new Error(upErr.message);
  }
}

async function run(): Promise<void> {
  const doSeed = process.argv.includes('--seed');
  const client = supabaseAdmin;

  console.log('\n=== Flujo InvTrack: Recurso → Solicitar → Aprobar → Préstamos ===\n');

  // 1) Organización y perfil
  const { data: orgs } = await client.from('organizations').select('id, name').limit(1);
  const org = orgs?.[0];
  if (!org) {
    console.error('No hay organización en la base de datos. Crea una desde la app o ejecuta con --seed: npm run test:flow:seed');
    process.exit(1);
  }
  console.log('1. Organización:', org.name, `(${org.id})`);

  const { data: profiles } = await client.from('profiles').select('id, full_name, organization_id').eq('organization_id', org.id).limit(1);
  const profile = profiles?.[0];
  if (!profile) {
    console.error('No hay perfil en esa organización.');
    process.exit(1);
  }
  console.log('2. Perfil solicitante:', profile.full_name, `(${profile.id})`);

  // 2) Recurso tipo iPad (varias unidades numeradas)
  let resourceId: string;
  let resourceName: string;

  if (doSeed && supabaseAdmin) {
    const { data: cat } = await supabaseAdmin.from('categories').select('id').eq('organization_id', org.id).limit(1).single();
    const categoryId = cat?.id ?? null;
    const { data: newRes, error: erRes } = await supabaseAdmin
      .from('resources')
      .insert({
        name: 'iPad (test)',
        sku: 'IPAD-TEST-' + Date.now(),
        description: 'Tablet iPad para pruebas de flujo multiunidad',
        category_id: categoryId,
        type: 'reusable',
        initial_quantity: 5,
        organization_id: org.id,
      })
      .select('id, name')
      .single();
    if (erRes || !newRes) {
      console.error('Error creando recurso:', erRes?.message);
      process.exit(1);
    }
    resourceId = newRes.id;
    resourceName = newRes.name;
    console.log('3. Recurso creado:', resourceName, `(${resourceId})`);

    for (let i = 1; i <= 5; i++) {
      const { error: eu } = await supabaseAdmin.from('resource_units').insert({
        resource_id: resourceId,
        serial_number: `IPAD-${String(i).padStart(3, '0')}`,
        status: 'available',
        organization_id: org.id,
      });
      if (eu) console.warn('   Unidad', i, ':', eu.message);
    }
    console.log('   Unidades creadas: IPAD-001 a IPAD-005 (5 disponibles)');
  } else {
    const { data: resources } = await client.from('resources').select('id, name').eq('organization_id', org.id).limit(5);
    const ipad = resources?.find(r => r.name.toLowerCase().includes('ipad')) ?? resources?.[0];
    if (!ipad) {
      console.error('No hay recurso. Ejecuta con --seed y SUPABASE_SERVICE_ROLE_KEY para crear un iPad de prueba.');
      process.exit(1);
    }
    resourceId = ipad.id;
    resourceName = ipad.name;
    console.log('3. Recurso:', resourceName, `(${resourceId})`);
  }

  const { data: unitsBefore } = await client.from('resource_units').select('id, serial_number, status').eq('resource_id', resourceId);
  const availableBefore = unitsBefore?.filter(u => u.status === 'available').length ?? 0;
  console.log('   Unidades disponibles ahora:', availableBefore);

  // 3) Crear solicitud de 5 unidades (como el flujo "solicitar 5 iPads: #1..#5")
  const quantityRequested = Math.min(5, availableBefore);
  if (quantityRequested < 1) {
    console.error('No hay unidades disponibles para solicitar.');
    process.exit(1);
  }

  const { data: newRequest, error: errReq } = await client
    .from('requests')
    .insert({
      user_id: profile.id,
      organization_id: org.id,
      resource_id: resourceId,
      quantity: quantityRequested,
      urgency: 'normal',
      notes: `[Test] Solicitud de ${quantityRequested} unidades (flujo script).`,
      status: 'pending',
    })
    .select('id, resource_id, quantity, status')
    .single();

  if (errReq || !newRequest) {
    console.error('Error creando solicitud:', errReq?.message);
    process.exit(1);
  }
  console.log('4. Solicitud creada: id', newRequest.id, '| cantidad:', newRequest.quantity, '| estado:', newRequest.status);

  // 4) Aprobar y asignar préstamos (allocateAndCreateLoans)
  const requestForAllocate = {
    ...newRequest,
    resources: { name: resourceName },
    profiles: { id: profile.id },
    organization_id: org.id,
    user_id: profile.id,
  };
  try {
    await allocateAndCreateLoans(client, requestForAllocate, profile.id);
  } catch (e) {
    console.error('Error al aprobar/asignar préstamos:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  // Marcar solicitud como aprobada
  await client.from('requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', newRequest.id);
  console.log('5. Solicitud aprobada y préstamos creados.');

  // 5) Verificación
  const { data: loans } = await client.from('loans').select('id, unit_id, user_id, status').eq('request_id', newRequest.id);
  const loanCount = loans?.length ?? 0;
  const unitIdsFromLoans = (loans ?? []).map((l) => l.unit_id).filter(Boolean);
  const { data: assignedUnits } =
    unitIdsFromLoans.length > 0
      ? await client.from('resource_units').select('id, status').in('id', unitIdsFromLoans)
      : { data: [] };
  const assignedNowOnLoan = assignedUnits?.filter((u) => u.status === 'on_loan').length ?? 0;
  const { data: unitsAfter } = await client.from('resource_units').select('id, status').eq('resource_id', resourceId);
  const totalOnLoanForResource = unitsAfter?.filter((u) => u.status === 'on_loan').length ?? 0;

  console.log('6. Verificación:');
  console.log('   Préstamos creados para esta solicitud:', loanCount);
  console.log('   Unidades asignadas en esta aprobación (on_loan):', assignedNowOnLoan);
  console.log('   Total unidades del recurso en préstamo:', totalOnLoanForResource, totalOnLoanForResource > quantityRequested ? '(incluye préstamos anteriores)' : '');
  const ok = loanCount === quantityRequested && assignedNowOnLoan === quantityRequested;
  if (!ok) {
    console.warn('   Esperado:', quantityRequested, 'préstamos y', quantityRequested, 'unidades pasadas a on_loan en esta solicitud.');
  } else {
    console.log('   OK: coinciden con la cantidad solicitada.');
  }

  console.log('\n--- Checklist manual (UI) ---');
  console.log('1. Inicio: ver solicitudes pendientes y aprobar desde ahí.');
  console.log('2. Solicitudes: filtrar por estado; aprobar desde la lista.');
  console.log('3. Préstamos: comprobar que aparecen los', quantityRequested, 'préstamos.');
  console.log('4. Recursos: ver recurso', resourceName, 'y que disponibilidad bajó en', quantityRequested, 'unidades.');
  console.log('');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
