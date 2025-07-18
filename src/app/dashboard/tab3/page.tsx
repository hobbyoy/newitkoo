// src/app/dashboard/tab3/page.tsx
'use client'

import dynamic from 'next/dynamic'

const Tab3Client = dynamic(() => import('./Tab3Client'), { ssr: false })

export default function Page() {
  return <Tab3Client />
}


