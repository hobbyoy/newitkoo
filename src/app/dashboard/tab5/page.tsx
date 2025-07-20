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
  doc,
  DocumentData
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
  const [existing, setExisting] = useState<null | {
    inputFreshback: number
    totalDriverFreshback: number
    netFreshback: number
    createdAt: string
  }>(null)

  const loadDriverFreshbacks = async () => {
    if (!startDate || !endDate) return

    const q1 = query(
      collection(db, 'FinalPayouts'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    )
    const snap1 = await getDocs(q1)
    let total = 0
    snap1.forEach(doc => {
      const data = doc.data() as DocumentData
      total += data.freshback || 0
    })
    setTotalDriverFreshback(total)

    const q2 = query(
      collection(db, 'ItkooFreshbackProfits'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    )
    const snap2 = await getDocs(q2)
    if (!snap2.empty) {
      const d = snap2.docs[0].data()
      setInputFreshback(String(d.inputFreshback || ''))
      setNetFreshback((d.inputFreshback || 0) - (d.totalDriverFreshback || 0))
      setExisting({
        inputFreshback: d.inputFreshback || 0,
        totalDriverFreshback: d.totalDriverFreshback || 0,
        netFreshback: d.netFreshback || 0,
        createdAt: d.createdAt?.toDate?.().toLocaleString() || ''
      })
      setSaved(true)
    } else {
      setExisting(null)
      setSaved(false)
    }
  }

  useEffect(() => {
    loadDriverFreshbacks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  useEffect(() => {
    const inputValue = Number(inputFreshback) || 0
    setNetFreshback(inputValue - totalDriverFreshback)
  }, [inputFreshback, totalDriverFreshback])

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
      alert('✅ 저장 완료')
      setSaved(true)
      setExisting({
        inputFreshback: Number(inputFreshback),
        totalDriverFreshback,
        netFreshback,
        createdAt: new Date().toLocaleString()
      })
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
          </div>

          {existing && (
            <div className="mt-6 text-sm text-gray-600 bg-gray-50 border-t pt-3 px-2">
              <p>📦 저장된 기록:</p>
              <ul className="list-disc ml-5">
                <li>입력 프레시백: {existing.inputFreshback.toLocaleString()} 원</li>
                <li>기사 합계 프레시백: {existing.totalDriverFreshback.toLocaleString()} 원</li>
                <li>차익: {existing.netFreshback.toLocaleString()} 원</li>
                <li>저장 시각: {existing.createdAt}</li>
              </ul>
            </div>
          )}

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
