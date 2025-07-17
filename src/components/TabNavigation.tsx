// src/components/TabNavigation.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

const tabs = [
  { label: '👤 기사 입력', path: '/dashboard/tab0', role: 'admin' },
  { label: '📥 실적 입력', path: '/dashboard/tab1', role: 'admin' }
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
