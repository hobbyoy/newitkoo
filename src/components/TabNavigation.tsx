// MobileSidebarMenu.tsx — 데스크탑은 상단바, 모바일은 왼쪽 슬라이드 메뉴
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
      {/* 본문 밀어내기용 여백 */}
      <div className="h-[80px] hidden lg:block"></div>

      {/* ☰ 모바일 메뉴 버튼 */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-10 h-10 rounded-full bg-[#0088FF] text-white shadow-md flex items-center justify-center transition-transform duration-300 hover:scale-105"
        >
          ☰
        </button>
      </div>

      {/* 💻 데스크탑 상단 네비게이션 (Glassmorphism + 중앙 정렬) */}
      <div className="hidden lg:flex fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-white/70 backdrop-blur-xl shadow-md border border-white/30 rounded-full px-3 py-2 gap-2 items-center max-w-[960px] overflow-x-auto whitespace-nowrap">
        {visibleTabs.map(tab => (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-4 py-2 rounded-full text-[12px] font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis text-center max-w-[110px]
              ${activePath === tab.path
                ? 'bg-[#0088FF] text-white shadow-md scale-[1.02]'
                : 'text-[#333] hover:text-black hover:bg-[#0088FF]/10'}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* 📱 모바일 왼쪽 슬라이드 메뉴 */}
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