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
      {/* 모바일 메뉴 버튼 */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="px-3 py-2 bg-[#0088FF] text-white rounded-md shadow-md text-sm"
        >
          메뉴
        </button>
      </div>

      {/* 모바일 메뉴 드롭다운 */}
      {showMobileMenu && (
        <div className="fixed top-16 right-4 z-50 bg-white rounded-lg shadow-lg p-4 flex flex-col gap-2 w-60">
          {visibleTabs.map(tab => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activePath === tab.path
                  ? 'bg-[#0088FF] text-white'
                  : 'text-[#333] hover:bg-gray-100'
              }`}
              onClick={() => setShowMobileMenu(false)}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      {/* 데스크탑용 탭 네비게이션 */}
      <div className="hidden lg:block w-full px-4 py-2 bg-transparent">
        <div className="w-full max-w-[1120px] mx-auto bg-[#F0F0F0] rounded-full shadow-sm flex items-center px-2 h-[48px] overflow-hidden">
          <div className="flex w-full justify-between items-center">
            {visibleTabs.map(tab => (
              <Link
                key={tab.path}
                href={tab.path}
                className={`px-6 py-[8px] rounded-full text-[12px] font-medium text-center transform transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden text-ellipsis
                  ${activePath === tab.path
                    ? 'bg-white text-[#0088FF] font-semibold shadow-md scale-105'
                    : 'text-[#444] hover:text-black hover:scale-105'}
                `}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
