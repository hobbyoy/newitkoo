// MobileSidebarMenu.tsx — 모바일에서 왼쪽으로 슬라이드되는 입체감 있고 반투명한 메뉴
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

export default function MobileSidebarMenu() {
  const pathname = usePathname()
  const [activePath, setActivePath] = useState(pathname)
  const [role, setRole] = useState('')
  const [showMobileMenu, setShowMobileMenu] = useState(false)

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
      {/* 왼쪽 상단 토글 버튼 */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-10 h-10 rounded-full bg-[#0088FF] text-white shadow-md flex items-center justify-center transition-transform duration-300 hover:scale-105"
        >
          ☰
        </button>
      </div>

      {/* 왼쪽에서 슬라이드 인되는 메뉴 */}
      <div
        className={`fixed top-0 left-0 h-screen w-[240px] z-40 bg-white/80 backdrop-blur-xl rounded-r-2xl shadow-2xl transform transition-transform duration-300 ease-in-out
          ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}
      >
        <div className="p-5 pt-10 flex flex-col gap-4">
          {visibleTabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              onClick={() => setShowMobileMenu(false)}
              className={`block px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${activePath === tab.path
                  ? 'bg-[#0088FF] text-white shadow-md scale-[1.02]'
                  : 'text-[#333] hover:bg-[#0088FF]/10'}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
