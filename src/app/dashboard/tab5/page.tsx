// src/app/dashboard/tab5/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'

export default function Tab5() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [inputFreshback, setInputFreshback] = useState('')
  const [totalDriverFreshback, setTotalDriverFreshback] = useState(0)
  const [netFreshback, setNetFreshback] = useState(0)
  const [saved, setSaved] = useState(false)
  const [existingData, setExistingData] = useState<any>(null)

  useEffect(() => {
    const loadDriverFreshbacks = async () => {
      if (!startDate || !endDate) return
      const q = query(
        collection(db, 'FinalPayouts'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
      const snap = await getDocs(q)
      let total = 0
      snap.forEach(doc => {
        const data = doc.data()
        total += data.freshback || 0
      })
      setTotalDriverFreshback(total)
    }
    loadDriverFreshbacks()
  }, [startDate, endDate])

  useEffect(() => {
    const inputValue = Number(inputFreshback) || 0
    setNetFreshback(inputValue - totalDriverFreshback)
  }, [inputFreshback, totalDriverFreshback])

  useEffect(() => {
    const fetchExisting = async () => {
      if (!startDate || !endDate) return
      const q = query(
        collection(db, 'ItkooFreshbackProfits'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const data = snap.docs[0].data()
        setExistingData(data)
        setInputFreshback(String(data.inputFreshback || ''))
        setSaved(true)
      } else {
        setExistingData(null)
        setSaved(false)
      }
    }
    fetchExisting()
  }, [startDate, endDate])

  const handleSave = async () => {
    if (!startDate || !endDate || !inputFreshback) return
    try {
      await setDoc(doc(db, 'ItkooFreshbackProfits', `${startDate}_${endDate}`), {
        startDate,
        endDate,
        inputFreshback: Number(inputFreshback),
        totalDriverFreshback,
        netFreshback,
        createdAt: new Date()
      })
      setSaved(true)
      alert('✅ 저장 완료')
    } catch (err) {
      console.error('❌ 저장 실패:', err)
      alert('❌ 저장 실패')
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <TabNavigation />
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-800 mb-6">🥝 프레시백 정산 요약 (Tab5)</h1>

        <div className="flex gap-4 mb-4">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded w-40" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded w-40" />
        </div>

        <div className="bg-white shadow rounded p-4 border">
          <div className="grid gap-4 text-sm">
            <div className="flex justify-between items-center">
              <label className="text-gray-700 font-medium">📥 쿠팡 프레시백 수익 입력</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={inputFreshback}
                onChange={(e) => setInputFreshback(e.target.value)}
                className="border p-1 w-40 text-right rounded"
              />
            </div>
            <div className="flex justify-between items-center text-blue-700">
              <span>🧾 기사 지급 프레시백 합계</span>
              <span className="font-bold">{totalDriverFreshback.toLocaleString()} 원</span>
            </div>
            <div className="flex justify-between items-center text-green-700 text-lg font-semibold border-t pt-3">
              <span>💼 잇쿠 프레시백 수익 (차액)</span>
              <span>{netFreshback.toLocaleString()} 원</span>
            </div>

            {existingData && (
              <div className="mt-4 p-3 bg-gray-100 border rounded text-sm text-gray-700">
                <p>📦 저장된 기록:</p>
                <p>• 입력 프레시백: {existingData.inputFreshback?.toLocaleString()} 원</p>
                <p>• 기사 프레시백 합계: {existingData.totalDriverFreshback?.toLocaleString()} 원</p>
                <p>• 차익 수익: {existingData.netFreshback?.toLocaleString()} 원</p>
              </div>
            )}
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={handleSave}
              className={`px-4 py-2 rounded text-white ${saved ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              disabled={saved}
            >
              {saved ? '✅ 저장됨' : '💾 저장'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
