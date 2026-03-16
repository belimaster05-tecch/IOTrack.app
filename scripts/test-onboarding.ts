/**
 * Script de prueba: Flujo de alta de organización + invitación de usuarios
 *
 * Prueba el flujo completo:
 *   1. Crear usuario administrador
 *   2. Crear perfil
 *   3. Provisionar organización (admin → owner membership)
 *   4. Crear invitación para un miembro
 *   5. Simular registro del miembro (primer sign-in)
 *   6. Simular aceptación de invitación (lógica del trigger)
 *   7. Verificar membresías, perfiles e invitación
 *
 * Uso:
 *   npm run test:onboarding              # Ejecuta el flujo completo
 *   npm run test:onboarding -- --clean   # Elimina datos de prueba anteriores
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\n❌ Faltan variables de entorno:');
  if (!supabaseUrl) console.error('   NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceRoleKey) console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n   Agrégalas en .env.local y vuelve a ejecutar.\n');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_TAG = '[test-onboarding]';
const TS = Date.now();

const ADMIN_EMAIL  = `test-admin-${TS}@invtrack.test`;
const MEMBER_EMAIL = `test-member-${TS}@invtrack.test`;
const ORG_NAME     = `${TEST_TAG} Org ${TS}`;

function ok(msg: string)  { console.log(`   ✓ ${msg}`); }
function warn(msg: string) { console.warn(`   ⚠ ${msg}`); }
function fail(msg: string, err?: unknown): never {
  console.error(`   ✗ ${msg}`);
  if (err) {
    const e = err as any;
    console.error('    ', e?.message ?? e);
  }
  process.exit(1);
}
function step(n: number, msg: string) { console.log(`\n${n}. ${msg}`); }

// ── Limpieza ──────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n🧹 Limpiando datos de prueba...\n');

  const { data: orgs } = await db
    .from('organizations')
    .select('id')
    .ilike('name', `${TEST_TAG}%`);

  const orgIds = (orgs ?? []).map((o: any) => o.id);

  if (orgIds.length > 0) {
    await db.from('invitations').delete().in('organization_id', orgIds);
    await db.from('organization_memberships').delete().in('organization_id', orgIds);
    await db.from('profiles').delete().in('organization_id', orgIds);
    await db.from('organizations').delete().in('id', orgIds);
    ok(`${orgIds.length} organización(es) eliminada(s)`);
  } else {
    ok('No se encontraron organizaciones de prueba');
  }

  // Eliminar usuarios auth con el dominio de prueba
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = users.filter((u: any) => u.email?.endsWith('@invtrack.test'));
  for (const u of testUsers) {
    await db.auth.admin.deleteUser(u.id);
  }
  ok(`${testUsers.length} usuario(s) de prueba eliminado(s)`);

  console.log('\n   Listo.\n');
}

// ── Flujo principal ───────────────────────────────────────────────────────────

async function run() {
  const doClean = process.argv.includes('--clean');
  if (doClean) { await cleanup(); return; }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(' InvTrack — Flujo: Crear cuenta → Org → Invitar usuario');
  console.log('════════════════════════════════════════════════════════');
  console.log(`\n   Admin:   ${ADMIN_EMAIL}`);
  console.log(`   Miembro: ${MEMBER_EMAIL}`);
  console.log(`   Org:     ${ORG_NAME}`);

  // ── 1. Crear usuario administrador ──────────────────────────────────────────
  step(1, 'Crear usuario administrador (auth.users)');
  const { data: adminAuth, error: adminErr } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: { has_password: true, full_name: 'Admin Test' },
  });
  if (adminErr || !adminAuth.user) fail('No se pudo crear el usuario admin', adminErr);
  const adminId = adminAuth.user!.id;
  ok(`ID: ${adminId}`);

  // ── 2. Crear perfil ──────────────────────────────────────────────────────────
  step(2, 'Crear perfil del administrador');
  const { error: profErr } = await db.from('profiles').upsert(
    { id: adminId, full_name: 'Admin Test', role_name: 'admin' },
    { onConflict: 'id' }
  );
  if (profErr) fail('Error creando perfil', profErr);
  ok('Perfil insertado');

  // ── 3. Crear organización ────────────────────────────────────────────────────
  step(3, 'Crear organización');
  const { data: org, error: orgErr } = await db
    .from('organizations')
    .insert({ name: ORG_NAME })
    .select('id, name')
    .single();
  if (orgErr || !org) fail('Error creando organización', orgErr);
  const orgId = (org as any).id as string;
  ok(`Organización: "${(org as any).name}" (${orgId})`);

  // ── 4. Vincular admin → owner ────────────────────────────────────────────────
  step(4, 'Vincular admin como owner de la organización');
  const { error: memAdminErr } = await db.from('organization_memberships').insert({
    organization_id: orgId,
    user_id: adminId,
    role: 'owner',
    status: 'active',
    is_default: true,
    joined_at: new Date().toISOString(),
  });
  if (memAdminErr) fail('Error creando membresía del admin', memAdminErr);

  const { error: profOrgErr } = await db
    .from('profiles')
    .update({ organization_id: orgId, role_name: 'admin' })
    .eq('id', adminId);
  if (profOrgErr) fail('Error actualizando org en el perfil', profOrgErr);
  ok('Admin vinculado como owner');

  // ── 5. Crear invitación ──────────────────────────────────────────────────────
  step(5, 'Crear invitación para el miembro');
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: invErr } = await db.from('invitations').insert({
    organization_id: orgId,
    email: MEMBER_EMAIL,
    role: 'member',
    token,
    expires_at: expiresAt,
    invited_by: adminId,
    status: 'pending',
  });
  if (invErr) fail('Error creando invitación', invErr);
  ok(`Token: ${token.slice(0, 8)}...  (expira: ${new Date(expiresAt).toLocaleDateString('es')})`);
  ok('(Email omitido — se usaría auth.admin.inviteUserByEmail en producción)');

  // ── 6. Simular registro del miembro ──────────────────────────────────────────
  step(6, 'Simular registro del miembro (primer sign-in)');
  const { data: memberAuth, error: memberErr } = await db.auth.admin.createUser({
    email: MEMBER_EMAIL,
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: { has_password: false, full_name: 'Miembro Test' },
  });
  if (memberErr || !memberAuth.user) fail('Error creando usuario miembro', memberErr);
  const memberId = memberAuth.user!.id;
  ok(`ID: ${memberId}`);

  const { error: memProfErr } = await db.from('profiles').upsert(
    { id: memberId, full_name: 'Miembro Test', role_name: 'employee' },
    { onConflict: 'id' }
  );
  if (memProfErr) fail('Error creando perfil del miembro', memProfErr);
  ok('Perfil del miembro creado');

  // ── 7. Simular aceptación de invitación (lógica del trigger) ─────────────────
  step(7, 'Simular aceptación de invitación');

  const { data: inv, error: invFetchErr } = await db
    .from('invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (invFetchErr || !inv) fail('Invitación no encontrada o expirada', invFetchErr);
  ok(`Invitación válida para: ${(inv as any).email}`);

  // Crear membresía del miembro
  const { error: memInsErr } = await db.from('organization_memberships').insert({
    organization_id: orgId,
    user_id: memberId,
    role: (inv as any).role,
    status: 'active',
    is_default: true,
    joined_at: new Date().toISOString(),
  });
  if (memInsErr) fail('Error creando membresía del miembro', memInsErr);

  // Actualizar perfil del miembro con la org
  await db.from('profiles')
    .update({ organization_id: orgId, role_name: 'employee' })
    .eq('id', memberId);

  // Marcar invitación como aceptada
  const { error: invUpdateErr } = await db.from('invitations')
    .update({ accepted_at: new Date().toISOString(), status: 'accepted' })
    .eq('id', (inv as any).id);
  if (invUpdateErr) fail('Error actualizando invitación', invUpdateErr);
  ok('Membresía creada e invitación marcada como aceptada');

  // ── 8. Verificación ──────────────────────────────────────────────────────────
  step(8, 'Verificación final');

  const { data: memberships } = await db
    .from('organization_memberships')
    .select('user_id, role, status')
    .eq('organization_id', orgId);

  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, role_name, organization_id')
    .eq('organization_id', orgId);

  const { data: invResult } = await db
    .from('invitations')
    .select('status, accepted_at, email')
    .eq('token', token)
    .single();

  console.log('\n   Membresías en la organización:');
  for (const m of (memberships ?? []) as any[]) {
    const p = (profiles ?? [] as any[]).find((p: any) => p.id === m.user_id);
    console.log(`      • ${p?.full_name ?? m.user_id}  |  rol: ${m.role}  |  estado: ${m.status}`);
  }

  const adminMem  = (memberships ?? [] as any[]).find((m: any) => m.user_id === adminId);
  const memberMem = (memberships ?? [] as any[]).find((m: any) => m.user_id === memberId);
  const invFinal  = invResult as any;

  let passed = true;

  if (adminMem?.role === 'owner' && adminMem?.status === 'active') ok('Admin es owner activo');
  else { warn('Admin no tiene rol/estado correcto'); passed = false; }

  if (memberMem?.role === 'member' && memberMem?.status === 'active') ok('Miembro es member activo');
  else { warn('Miembro no tiene rol/estado correcto'); passed = false; }

  if (invFinal?.status === 'accepted') ok('Invitación marcada como "accepted"');
  else { warn(`Invitación en estado: "${invFinal?.status ?? '?'}"`); passed = false; }

  const profCount = (profiles ?? []).length;
  if (profCount === 2) ok(`${profCount} perfiles vinculados a la org`);
  else warn(`Perfiles en org: ${profCount} (esperado 2)`);

  // ── Resumen ──────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════');
  if (passed) {
    console.log(' ✅  PASS — Flujo de onboarding funciona correctamente');
  } else {
    console.log(' ⚠️  PARCIAL — Algunos checks fallaron (ver arriba)');
  }
  console.log('════════════════════════════════════════════════════════');
  console.log('\n   Para limpiar los datos de prueba:');
  console.log('   npm run test:onboarding -- --clean\n');
}

run().catch((e) => {
  console.error('\n❌ Error inesperado:', (e as any)?.message ?? e);
  process.exit(1);
});
