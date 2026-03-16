'use client'
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo salió mal</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Ocurrió un error inesperado.</p>
            <button
              onClick={reset}
              style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
