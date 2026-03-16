import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4 bg-[#EEEEED] dark:bg-[#191919]">
      <p className="text-7xl font-bold text-gray-200 dark:text-[#2A2A2A]">404</p>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E8E8E6]">Página no encontrada</h2>
      <p className="text-sm text-gray-500 dark:text-[#787774] max-w-sm">La página que buscas no existe o fue movida.</p>
      <Link href="/dashboard" className="px-4 py-2 bg-gray-900 dark:bg-[#E8E8E6] text-white dark:text-[#191919] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
        Ir al Dashboard
      </Link>
    </div>
  )
}
