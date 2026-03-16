import { Suspense } from 'react'
import { Auth } from '@/page-components/Auth'

export default function RegisterPage() {
  return (
    <Suspense>
      <Auth initialMode="register" />
    </Suspense>
  )
}
