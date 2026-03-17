import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { RoleProvider } from '@/contexts/RoleContext'
import { FeaturesProvider } from '@/contexts/FeaturesContext'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'IOTrack',
  description: 'Gestión de recursos e inventario',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <RoleProvider>
              <FeaturesProvider>
                {children}
              </FeaturesProvider>
            </RoleProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
