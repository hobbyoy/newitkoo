// src/app/dashboard/tab9/page.tsx
'use client'

import React from 'react'
import TabNavigation from '@/components/TabNavigation'

/**
 * 🔧 목적: 빌드 에러 "File .../tab9/page.tsx is not a module" 해결
 * - Next App Router의 page.tsx는 반드시 기본 컴포넌트를 export default 해야 합니다.
 * - 이 파일은 최소한의 UI만 포함한 정상 모듈입니다. (추후 수동/월간 분배 UI로 교체 가능)
 */

export default function Tab9Page() {
  return (
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-3xl mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">특수 페이지 (준비 중)</h1>
        <p className="text-gray-600">
          이 영역은 운영자용 특수 기능(예: 일 단위 수동 분배 또는 월→일 자동 분배)을 위한 자리입니다.
          추후 Tab11/Tab12 구현이 완료되면, 이 페이지를 리다이렉트하거나 안내 페이지로 유지할 수 있습니다.
        </p>
      </main>
    </div>
  )
}
