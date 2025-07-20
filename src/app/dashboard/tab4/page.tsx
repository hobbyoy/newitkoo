// src/app/dashboard/tab4/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'

interface FinalPayout {
  uid: string
  name: string
  email: string
  itkooFee: number
  startDate: string
  endDate: string
}

interface Deductions {
  insOp: number
  empOp: number
  rentalOp: number
  etcOp: number
}

export default function Tab4() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [payouts, setPayouts] = useState<FinalPayout[]>([])
  const [deductions, setDeductions] = useState<Record<string, Partial<Deductions>>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const loadData = async () => {
    if (!startDate || !endDate) return
    try {
      const q = query(
        collection(db, 'FinalPayouts'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
      const snap = await getDocs(q)
      const result: FinalPayout[] = []
      const savedMap: Record<string, boolean> = {}
      const deductionMap: Record<string, Partial<Deductions>> = {}

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as FinalPayout
        result.push(data)

        const payoutRef = doc(db, 'ItkooPayouts', `${data.uid}_${startDate}_${endDate}`)
        const exist = await getDoc(payoutRef)
        savedMap[data.uid] = exist.exists()

        if (exist.exists()) {
          const existingData = exist.data()
          deductionMap[data.uid] = {
            insOp: existingData.insOp || 0,
            empOp: existingData.empOp || 0,
            rentalOp: existingData.rentalOp || 0,
            etcOp: existingData.etcOp || 0
          }
        }
      }

      setPayouts(result)
      setSaved(savedMap)
      setDeductions(deductionMap)
    } catch (error) {
      console.error('❌ Error loading payouts:', error)
    }
  }

  const handleChange = (uid: string, field: keyof Deductions, value: string) => {
    setDeductions(prev => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        [field]: Number(value) || 0
      }
    }))
  }

  const handleSave = async (data: FinalPayout) => {
    const d = deductions[data.uid] || {}
    const insOp = d.insOp || 0
    const empOp = d.empOp || 0
    const rentalOp = d.rentalOp || 0
    const etcOp = d.etcOp || 0
    const finalNet = (data.itkooFee ?? 0) - insOp - empOp - rentalOp - etcOp

    try {
      await setDoc(doc(db, 'ItkooPayouts', `${data.uid}_${startDate}_${endDate}`), {
        uid: data.uid,
        name: data.name,
        email: data.email,
        startDate,
        endDate,
        itkooFee: data.itkooFee ?? 0,
        insOp,
        empOp,
        rentalOp,
        etcOp,
        finalNet,
        createdAt: new Date()
      })
      setSaved(prev => ({ ...prev, [data.uid]: true }))
    } catch (err) {
      console.error('❌ Error saving payout:', err)
    }
  }

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold mb-6 text-blue-700">💼 기사별 수수료 계산 (Tab4)</h1>

        <div className="flex gap-4 mb-6">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded" />
          <button onClick={loadData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">불러오기</button>
        </div>

        {payouts.length === 0 ? (
          <p className="text-gray-500 text-sm">📭 불러온 기사 수익 데이터가 없습니다.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-100 text-center">
              <tr>
                <th className="border p-2">기사명</th>
                <th className="border p-2">이메일</th>
                <th className="border p-2">잇쿠 수수료</th>
                <th className="border p-2">산재보험</th>
                <th className="border p-2">고용보험</th>
                <th className="border p-2">용차</th>
                <th className="border p-2">기타</th>
                <th className="border p-2">최종 수익</th>
                <th className="border p-2">저장</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => {
                const d = deductions[p.uid] || {}
                const insOp = d.insOp || 0
                const empOp = d.empOp || 0
                const rentalOp = d.rentalOp || 0
                const etcOp = d.etcOp || 0
                const finalNet = (p.itkooFee ?? 0) - insOp - empOp - rentalOp - etcOp

                return (
                  <tr key={p.uid} className="text-center border-t">
                    <td className="border p-2">{p.name}</td>
                    <td className="border p-2">{p.email}</td>
                    <td className="border p-2">{(p.itkooFee ?? 0).toLocaleString()}</td>
                    {[['insOp', insOp], ['empOp', empOp], ['rentalOp', rentalOp], ['etcOp', etcOp]].map(([key, val]) => (
                      <td className="border p-2" key={key}>
                        <input
                          type="number"
                          className="w-24 border rounded px-1 text-right"
                          min={0}
                          step={1000}
                          value={val}
                          onChange={(e) => handleChange(p.uid, key as keyof Deductions, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border p-2 font-semibold text-green-700">{(finalNet ?? 0).toLocaleString()}</td>
                    <td className="border p-2">
                      {saved[p.uid] ? '✅ 저장됨' : (
                        <button onClick={() => handleSave(p)} className="bg-blue-500 text-white px-2 py-1 rounded">저장</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
