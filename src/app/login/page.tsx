import { Suspense } from 'react'
import { Auth } from '@/page-components/Auth'

export default function LoginPage() {
  return (
    <Suspense>
      <Auth initialMode="login" />
    </Suspense>
  )
}
