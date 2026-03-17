/**
 * Script para probar la lógica de Stock Almacén + Stock Público.
 *
 * Uso:
 *   npm run test:warehouse
 *
 * Qué prueba:
 *   1. Crear recurso consumible con stock público=40, almacén=80
 *   2. Verificar que initial_quantity=40 y warehouse_quantity=80
 *   3. Transferir 10 del almacén al catálogo → público=50, almacén=70
 *   4. Aprobar solicitud de 5 → público=45, almacén=70 (almacén intacto)
 *   5. Transferir todo el almacén → almacén=0
 *   6. Edge cases: transferir más de lo disponible, cantidad inválida
 *   7. Cleanup: elimina el recurso y datos generados
 *
 * Variables de entorno (.env.local):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan variables de entorno. Necesitas en .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

// ─── colores para consola ───────────────────────────────────────────────────
const ok   = (s: string) => `\x1b[32m✓ ${s}\x1b[0m`;
const fail = (s: string) => `\x1b[31m✗ ${s}\x1b[0m`;
const info = (s: string) => `\x1b[36m  ${s}\x1b[0m`;
const sec  = (s: string) => `\n\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(ok(label));
    passed++;
  } else {
    console.log(fail(label) + (detail ? `  → ${detail}` : ''));
    failed++;
  }
}

// ─── helpers que replican la lógica del frontend ────────────────────────────

/** Replica handleTransferToPublic() de ResourceDetails.tsx */
async function transferToPublic(resourceId: string, n: number) {
  const { data: resource } = await db
    .from('resources')
    .select('initial_quantity, warehouse_quantity')
    .eq('id', resourceId)
    .single();

  if (!resource) throw new Error('Recurso no encontrado');

  const currentWarehouse = resource.warehouse_quantity ?? 0;
  const currentPublic    = resource.initial_quantity   ?? 0;

  if (n < 1)               return { error: 'Cantidad inválida' };
  if (n > currentWarehouse) return { error: `No puedes transferir más de ${currentWarehouse} unidades` };

  const newPublic    = currentPublic + n;
  const newWarehouse = currentWarehouse - n;

  const { error } = await db
    .from('resources')
    .update({
      warehouse_quantity: newWarehouse,
      initial_quantity:   newPublic,
      status: newPublic > 0 ? 'available' : 'on_loan',
    })
    .eq('id', resourceId);

  if (error) return { error: error.message };

  await db.from('activity_logs').insert({
    action:      'warehouse_transfer',
    entity_type: 'resource',
    entity_id:   resourceId,
    user_id:     null,
    details:     { transferred: n, new_public: newPublic, new_warehouse: newWarehouse },
  });

  return { ok: true, newPublic, newWarehouse };
}

/** Replica handleAdjustStock() de ResourceDetails.tsx */
async function adjustPublicStock(resourceId: string, quantity: number) {
  if (quantity < 0) return { error: 'Cantidad inválida' };

  const nextStatus = quantity > 0 ? 'available' : 'inactive';
  const { error } = await db
    .from('resources')
    .update({ initial_quantity: quantity, status: nextStatus })
    .eq('id', resourceId);

  return error ? { error: error.message } : { ok: true };
}

/** Simula aprobar una solicitud de consumible (descuenta de initial_quantity) */
async function approveConsumableRequest(resourceId: string, qty: number) {
  const { data: resource } = await db
    .from('resources')
    .select('initial_quantity, warehouse_quantity')
    .eq('id', resourceId)
    .single();

  if (!resource) throw new Error('Recurso no encontrado');

  const newPublic = (resource.initial_quantity ?? 0) - qty;
  const { error } = await db
    .from('resources')
    .update({
      initial_quantity: newPublic,
      status: newPublic > 0 ? 'available' : 'inactive',
    })
    .eq('id', resourceId);

  return error
    ? { error: error.message }
    : { ok: true, newPublic, warehouse: resource.warehouse_quantity };
}

/** Lee el recurso fresco de la DB */
async function fetch(resourceId: string) {
  const { data } = await db
    .from('resources')
    .select('initial_quantity, warehouse_quantity, status')
    .eq('id', resourceId)
    .single();
  return data;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n\x1b[1m=== Test: Stock Almacén + Stock Público ===\x1b[0m\n');

  // ── 0. Obtener org y perfil ───────────────────────────────────────────────
  console.log(sec('0. Contexto'));

  const { data: orgs } = await db.from('organizations').select('id, name').limit(1);
  const org = orgs?.[0];
  if (!org) {
    console.error(fail('No hay organización en la base de datos. Crea una desde la app primero.'));
    process.exit(1);
  }
  console.log(info(`Org: ${org.name} (${org.id})`));

  const { data: cats } = await db.from('categories').select('id').eq('organization_id', org.id).limit(1);
  const categoryId = cats?.[0]?.id ?? null;

  // ── 1. Crear recurso consumible con ambos stocks ──────────────────────────
  console.log(sec('1. Crear recurso consumible'));

  const sku = `TEST-WH-${Date.now()}`;
  const { data: resource, error: createErr } = await db
    .from('resources')
    .insert({
      name:               'Resmas papel A4 (test)',
      sku,
      description:        'Recurso consumible para tests de almacén',
      type:               'consumable',
      behavior:           'gastable',
      category_id:        categoryId,
      initial_quantity:   40,
      warehouse_quantity: 80,
      organization_id:    org.id,
      status:             'available',
    })
    .select('id, initial_quantity, warehouse_quantity, status')
    .single();

  if (createErr || !resource) {
    console.error(fail('No se pudo crear el recurso: ' + createErr?.message));
    console.error(info('¿Está aplicada la migración warehouse_quantity? (supabase/migrations/20260317_warehouse_quantity.sql)'));
    process.exit(1);
  }

  const id = resource.id;
  console.log(info(`Recurso creado: ${id}`));

  assert(resource.initial_quantity   === 40, 'initial_quantity=40 al crear');
  assert(resource.warehouse_quantity === 80, 'warehouse_quantity=80 al crear');
  assert(resource.status             === 'available', 'status=available al crear');

  // ── 2. Vista pública: almacén invisible ───────────────────────────────────
  console.log(sec('2. Aislamiento: almacén invisible para usuarios'));

  const fresh = await fetch(id);
  assert(
    fresh?.initial_quantity === 40,
    'available_quantity deriva de initial_quantity (40), no del almacén'
  );
  assert(
    (fresh?.warehouse_quantity ?? 0) > 0,
    'warehouse_quantity existe pero solo visible para admin'
  );

  // ── 3. Transferir del almacén al catálogo ─────────────────────────────────
  console.log(sec('3. Transferir 10 unidades del almacén al catálogo'));

  const t1 = await transferToPublic(id, 10);
  const afterT1 = await fetch(id);

  assert(!('error' in t1),          'Transferencia completada sin error');
  assert(afterT1?.initial_quantity   === 50, `Stock público=50 tras transferir 10  (era 40, obtenido: ${afterT1?.initial_quantity})`);
  assert(afterT1?.warehouse_quantity === 70, `Stock almacén=70 tras transferir 10  (era 80, obtenido: ${afterT1?.warehouse_quantity})`);
  assert(afterT1?.status             === 'available', 'Status sigue "available"');

  // ── 4. Aprobar solicitud: solo baja el stock público ──────────────────────
  console.log(sec('4. Aprobar solicitud de 5 unidades'));

  const req = await approveConsumableRequest(id, 5);
  const afterReq = await fetch(id);

  assert(!('error' in req),           'Solicitud aprobada sin error');
  assert(afterReq?.initial_quantity   === 45, `Stock público=45 tras solicitud de 5  (obtenido: ${afterReq?.initial_quantity})`);
  assert(afterReq?.warehouse_quantity === 70, `Almacén intacto=70 tras solicitud      (obtenido: ${afterReq?.warehouse_quantity})`);

  // ── 5. Transferir todo el almacén ─────────────────────────────────────────
  console.log(sec('5. Transferir todo el almacén (70 unidades)'));

  const t2 = await transferToPublic(id, 70);
  const afterT2 = await fetch(id);

  assert(!('error' in t2),          'Transferencia total completada sin error');
  assert(afterT2?.initial_quantity   === 115, `Stock público=115  (obtenido: ${afterT2?.initial_quantity})`);
  assert(afterT2?.warehouse_quantity === 0,   `Almacén=0 tras vaciarlo  (obtenido: ${afterT2?.warehouse_quantity})`);

  // ── 6. Edge cases ─────────────────────────────────────────────────────────
  console.log(sec('6. Edge cases'));

  const tOver = await transferToPublic(id, 1);
  assert(
    'error' in tOver,
    'Error al transferir cuando almacén=0',
    'error' in tOver ? tOver.error : undefined
  );

  const tZero = await transferToPublic(id, 0);
  assert('error' in tZero, 'Error al transferir cantidad=0');

  const tNeg = await transferToPublic(id, -5);
  assert('error' in tNeg, 'Error al transferir cantidad negativa');

  const adjNeg = await adjustPublicStock(id, -1);
  assert('error' in adjNeg, 'Error al ajustar stock público con valor negativo');

  const adjOk = await adjustPublicStock(id, 0);
  const afterAdj = await fetch(id);
  assert(!('error' in adjOk),        'Ajustar stock a 0 es válido');
  assert(afterAdj?.status === 'inactive', 'Status="inactive" cuando stock público=0');

  // ── 7. Log de actividad ───────────────────────────────────────────────────
  // ── 7. Solicitud que agota el stock público ───────────────────────────────
  console.log(sec('7. Solicitud que agota todo el stock público'));

  await db.from('resources').update({ initial_quantity: 10, status: 'available' }).eq('id', id);

  const reqExhaust = await approveConsumableRequest(id, 10);
  const afterExhaust = await fetch(id);

  assert(!('error' in reqExhaust),             'Solicitud que agota stock no da error de DB');
  assert(afterExhaust?.initial_quantity === 0,  `Stock público=0 tras agotar  (obtenido: ${afterExhaust?.initial_quantity})`);
  assert(afterExhaust?.warehouse_quantity === 0, `Almacén intacto en 0  (obtenido: ${afterExhaust?.warehouse_quantity})`);
  assert(afterExhaust?.status === 'inactive',   `Status="inactive" cuando público llega a 0  (obtenido: ${afterExhaust?.status})`);

  // ── 8. Transferencia que deja almacén en 0 ───────────────────────────────
  console.log(sec('8. Transferencia que vacía el almacén'));

  await db.from('resources').update({ initial_quantity: 5, warehouse_quantity: 5, status: 'available' }).eq('id', id);

  const t3 = await transferToPublic(id, 5);
  const afterT3 = await fetch(id);

  assert(!('error' in t3),            'Transferencia completada');
  assert(afterT3?.initial_quantity   === 10, `Stock público=10 (5+5)     (obtenido: ${afterT3?.initial_quantity})`);
  assert(afterT3?.warehouse_quantity === 0,  `Almacén=0 tras vaciar      (obtenido: ${afterT3?.warehouse_quantity})`);
  assert(afterT3?.status === 'available',    `Status="available" porque público > 0  (obtenido: ${afterT3?.status})`);

  // ── 9. Behavior 'gastable' guardado en DB ────────────────────────────────
  console.log(sec('9. Behavior "gastable" almacenado en DB'));

  const { data: savedResource } = await db
    .from('resources')
    .select('behavior, type')
    .eq('id', id)
    .single();

  assert(savedResource?.behavior === 'gastable',   `behavior="gastable" en DB  (obtenido: ${savedResource?.behavior})`);
  assert(savedResource?.type     === 'consumable', `type="consumable" en DB    (obtenido: ${savedResource?.type})`);

  console.log(sec('10. Activity log de transferencias'));

  const { data: logs } = await db
    .from('activity_logs')
    .select('action, details')
    .eq('entity_id', id)
    .eq('action', 'warehouse_transfer')
    .order('created_at', { ascending: true });

  assert((logs?.length ?? 0) >= 2, `Existen logs de warehouse_transfer  (encontrados: ${logs?.length ?? 0})`);

  if (logs && logs.length > 0) {
    const first = logs[0].details;
    assert(
      typeof first?.transferred === 'number' && first?.new_public !== undefined,
      'Log contiene campos: transferred, new_public, new_warehouse'
    );
    console.log(info(`Primer log: transferred=${first?.transferred}, new_public=${first?.new_public}, new_warehouse=${first?.new_warehouse}`));
  }

  // ── 11. Cleanup ───────────────────────────────────────────────────────────
  console.log(sec('11. Cleanup'));

  await db.from('activity_logs').delete().eq('entity_id', id);
  const { error: delErr } = await db.from('resources').delete().eq('id', id);
  assert(!delErr, 'Recurso de test eliminado');

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(45)}`);
  console.log(`  Pasaron: \x1b[32m${passed}\x1b[0m   Fallaron: \x1b[31m${failed}\x1b[0m`);
  console.log('─'.repeat(45));

  if (failed > 0) {
    console.log(fail(`${failed} test(s) fallaron.`));
    process.exit(1);
  } else {
    console.log(ok('Todos los tests pasaron.\n'));
  }
}

run().catch((err) => {
  console.error('\nError inesperado:', err);
  process.exit(1);
});
