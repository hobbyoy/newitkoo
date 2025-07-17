'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function useRoleGuard(requiredRole: 'admin' | 'driver') {
  const router = useRouter()

  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser
      if (!user) {
        router.replace('/login')
        return
      }

      const snap = await getDoc(doc(db, 'Users', user.uid))
      if (!snap.exists()) {
        alert('사용자 정보 없음')
        router.replace('/login')
        return
      }

      const role = snap.data()?.role
      if (role !== requiredRole) {
        alert(`접근 권한 없음: ${requiredRole}만 접근 가능`)
        router.replace('/login')
      }
    }

    checkRole()
  }, [router, requiredRole])
}
