'use client'
import { useEffect, useRef, useState } from 'react';
import { ScanLine, Search, Package, CheckCircle2, ArrowRight, AlertCircle, Camera, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';

type RecentScan = {
  code: string;
  resourceId: string;
  resourceName: string;
  sku: string;
  statusLabel: string;
  statusTone: 'success' | 'info' | 'warning';
  scannedAt: string;
};

export function ScanQR() {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [engine, setEngine] = useState<'barcode' | 'jsqr' | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('scanqr.recentScans');
      if (raw) setRecentScans(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scanqr.recentScans', JSON.stringify(recentScans.slice(0, 6)));
  }, [recentScans]);

  const registerRecentScan = (entry: RecentScan) => {
    setRecentScans((current) => {
      const deduped = current.filter((item) => !(item.resourceId === entry.resourceId && item.code === entry.code));
      return [entry, ...deduped].slice(0, 6);
    });
  };

  const resolveStatusMeta = (status?: string | null) => {
    if (status === 'available') {
      return { label: 'Disponible', tone: 'success' as const };
    }
    if (status === 'loaned') {
      return { label: 'Prestado', tone: 'info' as const };
    }
    if (status === 'maintenance') {
      return { label: 'Mantenimiento', tone: 'warning' as const };
    }
    return { label: 'Registrado', tone: 'info' as const };
  };

  const persistScanActivity = async (resourceId: string, resourceName: string, code: string) => {
    try {
      await supabase.from('activity_logs').insert({
        action: 'resource_scanned',
        entity_type: 'resource',
        entity_id: resourceId,
        details: {
          message: `Escaneo de ${resourceName}`,
          code,
        },
      });
    } catch {
      // No interrumpir el flujo del escáner por fallar el log.
    }
  };

  useEffect(() => {
    if (scanMode !== 'camera') return;
    let stream: MediaStream | null = null;
    let stop = false;
    let rafId = 0;
    const video = videoRef.current;
    if (!video) return;

    const start = async () => {
      setError(null);
      try {
        const Detector = (window as any).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        setEngine(detector ? 'barcode' : 'jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stop) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = (e: Event) => {
            video.removeEventListener('loadedmetadata', onReady);
            video.removeEventListener('canplay', onReady);
            reject(new Error('El video no pudo cargar'));
          };
          video.addEventListener('loadedmetadata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
          video.addEventListener('error', onError, { once: true });
        });
        if (stop) return;
        await video.play();
        if (stop) return;
        setScanning(true);
        const loop = async () => {
          if (stop) return;
          if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
            const w = 320;
            const h = 320;
            canvasRef.current.width = w;
            canvasRef.current.height = h;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              if (detector) {
                const codes = await detector.detect(canvasRef.current);
                if (codes && codes.length > 0) {
                  const raw = codes[0].rawValue || '';
                  setDetectedCode(raw);
                  handleLookup(raw);
                  stop = true;
                  setScanning(false);
                  return;
                }
              } else {
                const imageData = ctx.getImageData(0, 0, w, h);
                const result = jsQR(imageData.data, w, h);
                if (result && result.data) {
                  const raw = result.data;
                  setDetectedCode(raw);
                  handleLookup(raw);
                  stop = true;
                  setScanning(false);
                  return;
                }
              }
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        loop();
      } catch (e: unknown) {
        if (!stop) setError(e instanceof Error ? e.message : 'No se pudo iniciar la cámara');
      }
    };
    start();
    return () => {
      stop = true;
      if (rafId) cancelAnimationFrame(rafId);
      setScanning(false);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [scanMode]);

  const handleLookup = async (code: string) => {
    try {
      setError(null);
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        setError('Código vacío');
        return;
      }
      // 1) Buscar por SKU del recurso (cada recurso tiene SKU único)
      const { data: resourcesData, error: resErr } = await supabase
        .from('resources')
        .select('id, name, sku, status')
        .ilike('sku', normalized);
      if (!resErr) {
        const match = (resourcesData || []).find(r => (r.sku || '').toUpperCase() === normalized);
        if (match) {
          const statusMeta = resolveStatusMeta(match.status);
          registerRecentScan({
            code: normalized,
            resourceId: match.id,
            resourceName: match.name,
            sku: match.sku,
            statusLabel: statusMeta.label,
            statusTone: statusMeta.tone,
            scannedAt: new Date().toISOString(),
          });
          await persistScanActivity(match.id, match.name, normalized);
          router.push(`/recursos/${match.id}`);
          return;
        }
      }
      // 2) Buscar en barcodes (códigos asociados a recurso o unidad)
      const { data: barcodeRows, error: barErr } = await supabase
        .from('barcodes')
        .select('resource_id, unit_id')
        .ilike('code', normalized);
      const barcodeRow = (barcodeRows || []).length > 0 ? barcodeRows![0] : null;
      if (!barErr && barcodeRow && (barcodeRow.resource_id || barcodeRow.unit_id)) {
        let resourceId = barcodeRow.resource_id;
        if (!resourceId && barcodeRow.unit_id) {
          const { data: unit } = await supabase
            .from('resource_units')
            .select('resource_id, status')
            .eq('id', barcodeRow.unit_id)
            .single();
          resourceId = unit?.resource_id;
          if (resourceId) {
            const { data: resource } = await supabase
              .from('resources')
              .select('id, name, sku, status')
              .eq('id', resourceId)
              .single();
            if (resource) {
              const unitStatus = resolveStatusMeta(unit?.status ?? resource.status);
              registerRecentScan({
                code: normalized,
                resourceId: resource.id,
                resourceName: resource.name,
                sku: resource.sku,
                statusLabel: unitStatus.label,
                statusTone: unitStatus.tone,
                scannedAt: new Date().toISOString(),
              });
              await persistScanActivity(resource.id, resource.name, normalized);
            }
          }
        }
        if (resourceId) {
          if (!barcodeRow.unit_id) {
            const { data: resource } = await supabase
              .from('resources')
              .select('id, name, sku, status')
              .eq('id', resourceId)
              .single();
            if (resource) {
              const statusMeta = resolveStatusMeta(resource.status);
              registerRecentScan({
                code: normalized,
                resourceId: resource.id,
                resourceName: resource.name,
                sku: resource.sku,
                statusLabel: statusMeta.label,
                statusTone: statusMeta.tone,
                scannedAt: new Date().toISOString(),
              });
              await persistScanActivity(resource.id, resource.name, normalized);
            }
          }
          router.push(`/recursos/${resourceId}`);
          return;
        }
      }
      setError('No se encontró un recurso con ese código. Usa el SKU del recurso o un código registrado en códigos de barras.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error buscando el recurso');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-[#E8E8E6]">Escanear Recurso</h1>
        <p className="text-gray-500 dark:text-[#787774] text-sm">Escanea el código QR del recurso para ver sus detalles o registrar un préstamo.</p>
      </div>

      {/* SCANNER AREA */}
      <Card className="overflow-hidden shadow-sm">
        {/* Toggle Mode */}
        <div className="flex">
          <button
            onClick={() => setScanMode('camera')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${scanMode === 'camera' ? 'bg-white dark:bg-[#242424] text-gray-900 dark:text-[#E8E8E6] border-b-2 border-gray-900' : 'bg-gray-50 dark:bg-[#1D1D1D] text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6] hover:bg-gray-100 dark:hover:bg-[#333]'}`}
          >
            <ScanLine className="w-4 h-4" /> Escáner de Cámara
          </button>
          <button
            onClick={() => setScanMode('manual')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${scanMode === 'manual' ? 'bg-white dark:bg-[#242424] text-gray-900 dark:text-[#E8E8E6] border-b-2 border-gray-900' : 'bg-gray-50 dark:bg-[#1D1D1D] text-gray-500 dark:text-[#787774] hover:text-gray-700 dark:hover:text-[#C8C8C6] hover:bg-gray-100 dark:hover:bg-[#333]'}`}
          >
            <Search className="w-4 h-4" /> Ingreso Manual
          </button>
        </div>

        <div className="p-8 md:p-12 flex flex-col items-center justify-center min-h-[400px] bg-gray-50/50 dark:bg-[#1D1D1D]">
          {scanMode === 'camera' ? (
            <div className="flex flex-col items-center">
              <div className="relative w-64 h-64 bg-gray-900 rounded-2xl overflow-hidden shadow-inner mb-6 flex items-center justify-center">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="absolute inset-0 opacity-0" />
                <div className="absolute inset-0 border-2 border-white/20 m-8 rounded-lg"></div>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
                {!scanning && <Camera className="w-12 h-12 text-white/30" />}
              </div>
              {error ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-error-700 dark:text-red-400 bg-error-50 dark:bg-red-950/20 border border-error-200 dark:border-red-900/40 rounded-md px-3 py-2 text-sm">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setScanMode('manual')}>Usar modo manual</Button>
                    <Button variant="primary" size="sm" onClick={() => setScanMode('camera')}>Reintentar cámara</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#E8E8E6]">Apuntando a la cámara...</p>
                  <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">Alinea el código QR dentro del marco</p>
                  {detectedCode && <p className="text-xs text-gray-500 dark:text-[#787774] mt-1">Detectado: {detectedCode}</p>}
                  {engine && (
                    <span className="mt-2 inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#C8C8C6] border border-gray-200 dark:border-[#3A3A3A]">
                      Modo: {engine === 'barcode' ? 'BarcodeDetector' : 'jsQR'}
                    </span>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-2 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-[#2A2A2A] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-gray-600 dark:text-[#AAAAAA]" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-[#E8E8E6]">Ingresar Código SKU</h3>
                <p className="text-sm text-gray-500 dark:text-[#787774]">Si el código QR está dañado, ingresa el identificador manualmente.</p>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ej. TEC-0023"
                  className="flex-1 px-4 py-3 bg-white dark:bg-[#1D1D1D] border border-gray-200 dark:border-[#3A3A3A] rounded-xl text-sm dark:text-[#E8E8E6] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-[#E8E8E6] focus:border-transparent transition-shadow shadow-sm font-mono uppercase placeholder:text-gray-400 dark:placeholder:text-[#555]"
                />
                <Button variant="primary" className="bg-black text-white hover:bg-gray-800 px-6" onClick={() => handleLookup(manualCode)} disabled={!manualCode}>
                  Buscar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* RECENT SCANS */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] uppercase tracking-wider mb-4">Escaneos Recientes</h3>
        {recentScans.length === 0 ? (
          <Card className="p-6 text-sm text-gray-500 dark:text-[#787774]">
            Los recursos que escanees aparecerán aquí para reabrirlos rápido.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentScans.map((scan) => (
              <Card
                key={`${scan.resourceId}-${scan.code}`}
                className="p-4 flex items-center justify-between transition-colors cursor-pointer group"
                onClick={() => router.push(`/recursos/${scan.resourceId}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-[#1D1D1D] flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-gray-600 dark:text-[#AAAAAA]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#E8E8E6] group-hover:text-black dark:group-hover:text-white">{scan.resourceName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-[#787774]">{scan.sku}</span>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          scan.statusTone === 'success'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : scan.statusTone === 'warning'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300'
                        }`}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {scan.statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 dark:text-[#666]">
                      <Clock3 className="h-3 w-3" />
                      {new Date(scan.scannedAt).toLocaleString('es-DO', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-[#555] group-hover:text-gray-900 dark:group-hover:text-[#E8E8E6] transition-colors" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add keyframes for scan animation */}
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
