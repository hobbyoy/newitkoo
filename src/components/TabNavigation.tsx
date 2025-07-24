// src/components/TabNavigation.tsx (휠바 제거 + 심플 탭바)
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

const tabs = [
  { label: '실적 입력', path: '/dashboard/tab0', role: 'admin' },
  { label: '실적 입력(운)', path: '/dashboard/tab1', role: 'admin' },
  { label: '실적 리포트', path: '/dashboard/tab2', role: 'admin' },
  { label: '기사 정산', path: '/dashboard/tab3', role: 'admin' },
  { label: '수익 요약', path: '/dashboard/tab4', role: 'admin' },
  { label: '프레시백', path: '/dashboard/tab5', role: 'admin' },
  { label: '최종 손익', path: '/dashboard/tab6', role: 'admin' },
  { label: '기사 등록', path: '/dashboard/tab7', role: 'admin' },
  { label: '단가 관리', path: '/dashboard/tab8', role: 'admin' },
  { label: '실적 검수', path: '/dashboard/tab10', role: 'admin' }
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
    <div className="w-full px-4 py-2 bg-[#F5F5F5]">
      <div className="max-w-[1024px] mx-auto flex items-center justify-center bg-white rounded-full shadow-md px-3 h-[44px]">
        {/* 탭 목록 */}
        <div className="flex flex-1 justify-center gap-3 px-2 overflow-hidden">
          {visibleTabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`px-4 py-2 rounded-full text-[14px] transition-all font-medium
                ${activePath === tab.path
                  ? 'bg-white text-[#0088FF] font-semibold shadow-sm'
                  : 'text-gray-500 hover:text-black'}
              `}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
