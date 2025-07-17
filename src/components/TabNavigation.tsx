// src/components/TabNavigation.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

const tabs = [
  { label: '👤 기사 입력', path: '/dashboard/tab0', role: 'admin' },
  { label: '📥 실적 입력', path: '/dashboard/tab1', role: 'admin' },
  { label: '📊 실적 리포트', path: '/dashboard/tab2', role: 'admin' },
  { label: '💸 기사 정산', path: '/dashboard/tab3', role: 'admin' },
  { label: '📈 수익 요약', path: '/dashboard/tab4', role: 'admin' },
  { label: '🧊 프레시백', path: '/dashboard/tab5', role: 'admin' },
  { label: '🧾 최종 손익', path: '/dashboard/tab6', role: 'admin' },
  { label: '⚙️ 단가 관리', path: '/dashboard/tab8', role: 'admin' },
  { label: '👥 기사 계정', path: '/dashboard/tab9', role: 'admin' },
  { label: '✅ 실적 검수', path: '/dashboard/tab10', role: 'admin' }
]

export default function TabNavigation() {
  const pathname = usePathname()
  const [activePath, setActivePath] = useState(pathname)
  const [role, setRole] = useState('')

  useEffect(() => {
    setActivePath(pathname)
  }, [pathname])

  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, 'Users', user.uid))
      const role = snap.data()?.role
      setRole(role)
    }
    fetchRole()
  }, [])

  const visibleTabs = tabs.filter(tab => role === 'admin' || tab.role === 'driver')

  return (
    <nav className="flex border-b bg-white sticky top-0 z-10 overflow-x-auto text-sm">
      {visibleTabs.map(tab => (
        <Link
          key={tab.path}
          href={tab.path}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-all ${
            activePath === tab.path
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
