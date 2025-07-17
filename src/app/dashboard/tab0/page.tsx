'use client'

import { useState } from 'react'
import { db, auth } from '@/lib/firebase'
import { addDoc, collection } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'

export default function Tab0Page() {
  const [deliveryDate, setDeliveryDate] = useState('')
  const [coupangId, setCoupangId] = useState('')
  const [routeCode, setRouteCode] = useState('')
  const [isNight, setIsNight] = useState(false)
  const [deliveryCount, setDeliveryCount] = useState(0)
  const [returnCount, setReturnCount] = useState(0)
  const [message, setMessage] = useState('')
  const [userInfo, setUserInfo] = useState<{ uid: string; email: string } | null>(null)

  const router = useRouter()

  // 로그인된 사용자 정보 불러오기
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setUserInfo({ uid: user.uid, email: user.email ?? '' })
    } else {
      router.replace('/login')
    }
  })

  const handleSubmit = async () => {
    if (!deliveryDate || !coupangId || !routeCode) {
      setMessage('❗ 배송일자, 쿠팡ID, 노선명은 필수입니다.')
      return
    }

    try {
      await addDoc(collection(db, 'DailyRecords'), {
        uid: userInfo?.uid,
        email: userInfo?.email,
        deliveryDate,
        coupangId,
        routeCode,
        isNight,
        deliveryCount,
        returnCount,
        totalCount: deliveryCount + returnCount,
        createdAt: new Date()
      })

      setMessage('✅ 실적이 저장되었습니다.')
      // 입력 초기화
      setCoupangId('')
      setRouteCode('')
      setDeliveryCount(0)
      setReturnCount(0)
      setIsNight(false)
    } catch (error) {
      setMessage('❌ 저장 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">👤 기사 실적 입력 (tab0)</h1>

      <input
        type="date"
        value={deliveryDate}
        onChange={(e) => setDeliveryDate(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <input
        type="text"
        placeholder="쿠팡ID"
        value={coupangId}
        onChange={(e) => setCoupangId(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <input
        type="text"
        placeholder="노선명"
        value={routeCode}
        onChange={(e) => setRouteCode(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={isNight}
          onChange={(e) => setIsNight(e.target.checked)}
          className="mr-2"
        />
        <label>야간 운행 여부</label>
      </div>
      <input
        type="number"
        placeholder="배송 건수"
        value={deliveryCount}
        onChange={(e) => setDeliveryCount(parseInt(e.target.value) || 0)}
        className="border p-2 rounded w-full mb-2"
      />
      <input
        type="number"
        placeholder="반품 건수"
        value={returnCount}
        onChange={(e) => setReturnCount(parseInt(e.target.value) || 0)}
        className="border p-2 rounded w-full mb-2"
      />
      <p className="mb-2">🔢 총 건수: {deliveryCount + returnCount}</p>

      <button
        onClick={handleSubmit}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 w-full"
      >
        실적 저장
      </button>

      {message && <p className="mt-4 text-sm text-center">{message}</p>}
    </div>
  )
}
