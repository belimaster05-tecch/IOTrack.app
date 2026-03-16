export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-[#2A2A2A] rounded-lg" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-[#252525] rounded-md" />
        </div>
        <div className="h-9 w-32 bg-gray-200 dark:bg-[#2A2A2A] rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-xs bg-gray-100 dark:bg-[#252525] rounded-lg" />
        <div className="h-9 w-24 bg-gray-100 dark:bg-[#252525] rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-gray-100 dark:bg-[#252525] rounded-xl" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  )
}
