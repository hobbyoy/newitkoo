// SidebarNavigation.tsx (왼쪽 고정형, 접고 펼치는 기능 포함)
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

export default function SidebarNavigation() {
  const pathname = usePathname()
  const [activePath, setActivePath] = useState(pathname)
  const [role, setRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <>
      {/* 모바일 토글 버튼 */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 w-10 h-10 bg-[#D19C84] text-white rounded-full shadow-md flex items-center justify-center lg:hidden"
      >
        {sidebarOpen ? '←' : '→'}
      </button>

      {/* 사이드바 */}
      <div
        className={`fixed top-0 left-0 h-screen w-[72px] bg-[#D19C84]/90 rounded-r-2xl shadow-lg flex flex-col items-center py-4 transition-all duration-300 z-40
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* 아바타 */}
        <div className="w-12 h-12 rounded-full bg-white overflow-hidden">
          <img src="/avatar.png" alt="avatar" className="w-full h-full object-cover" />
        </div>

        {/* 탭 목록 */}
        <div className="flex flex-col gap-4 mt-10 text-white text-xs font-semibold">
          {visibleTabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200
                ${activePath === tab.path
                  ? 'bg-white text-[#0088FF] shadow-md'
                  : 'hover:bg-white/30'}
              `}
              title={tab.label}
            >
              <span className="truncate">{tab.label.slice(0, 2)}</span>
            </Link>
          ))}
        </div>

        {/* 하단 + 버튼 */}
        <div className="mt-auto">
          <button className="bg-orange-500 w-10 h-10 rounded-xl text-white text-xl leading-none shadow-md">
            +
          </button>
        </div>
      </div>
    </>
  )
}
