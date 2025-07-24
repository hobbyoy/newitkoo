// src/components/TabNavigation.tsx (사이드바 배경 반투명 회색 + 선택 탭은 화이트 배경 + 블루 테두리)
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
    <div className="w-full px-4 py-2" style={{ backgroundColor: '#A6A6A6B2' }}>
      <div className="w-full mx-auto flex items-center justify-center rounded-full shadow-md px-4 py-2 min-h-[48px]">
        {/* 탭 목록 */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {visibleTabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`px-5 py-[10px] rounded-full text-[14px] transition-all font-medium leading-none
                ${activePath === tab.path
                  ? 'bg-white text-[#0088FF] border border-[#0088FF] font-semibold'
                  : 'text-gray-600 hover:text-black bg-[#F0F0F0]'}
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
