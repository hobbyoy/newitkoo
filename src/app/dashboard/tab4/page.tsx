// src/app/dashboard/tab4/page.tsx
'use client'

import { useState } from 'react'
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
import DateRangeBox from '@/components/tab3/DateRangeBox' // ← Tab3 컴포넌트 재활용!

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
      const qy = query(
        collection(db, 'FinalPayouts'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
      const snap = await getDocs(qy)
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
          const existingData = exist.data() as Partial<Deductions>
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
    <div className="bg-white min-h-screen">
      <TabNavigation />
      <main className="max-w-[1024px] mx-auto py-8 px-4">
        {/* 제목 중앙 */}
        <h1 className="text-[12px] font-semibold text-black text-center mb-6">
          잇쿠 수익 정산 (Tab4)
        </h1>

        {/* 상단: Tab3의 DateRangeBox 재활용 (좌) + 우측은 정렬용 스페이서 */}
        <section className="grid grid-cols-1 lg:[grid-template-columns:360px_360px] lg:justify-center items-start gap-4 lg:gap-8">
          <div className="w-[360px]">
            <DateRangeBox
              onChange={(s, e) => {
                setStartDate(s)
                setEndDate(e)
              }}
            />
          </div>
          {/* 우측 칼럼: 정렬을 맞추기 위한 빈 칼럼(필요시 다른 컨트롤 배치 가능) */}
          <div className="w-[360px] lg:block hidden" />
          {/* 2행: 불러오기 버튼 중앙 배치 */}
          <div className="lg:col-span-2 flex justify-center mt-4 mb-8">
            <button
              onClick={loadData}
              className="w-[360px] h-11 rounded-xl bg-blue-600 text-white text-[14px] font-semibold shadow-sm hover:bg-blue-700"
            >
              불러오기
            </button>
          </div>
        </section>

        {/* 표: overflow-x + sticky header + zebra */}
        {payouts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">📭 불러온 기사 수익 데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border rounded-xl shadow-sm">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-center text-gray-700">
                  <th className="border-b px-3 py-3">기사명</th>
                  <th className="border-b px-3 py-3">이메일</th>
                  <th className="border-b px-3 py-3">잇쿠 수수료</th>
                  <th className="border-b px-3 py-3">산재보험</th>
                  <th className="border-b px-3 py-3">고용보험</th>
                  <th className="border-b px-3 py-3">운송지원비</th>
                  <th className="border-b px-3 py-3">기타</th>
                  <th className="border-b px-3 py-3">최종 수익</th>
                  <th className="border-b px-3 py-3">저장</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p, i) => {
                  const d = deductions[p.uid] || {}
                  const insOp = d.insOp || 0
                  const empOp = d.empOp || 0
                  const rentalOp = d.rentalOp || 0
                  const etcOp = d.etcOp || 0
                  const finalNet = (p.itkooFee ?? 0) - insOp - empOp - rentalOp - etcOp

                  return (
                    <tr key={p.uid} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-3">{p.name}</td>
                      <td className="px-3 py-3">{p.email}</td>
                      <td className="px-3 py-3 text-right">{(p.itkooFee ?? 0).toLocaleString()}</td>

                      {([
                        ['insOp', insOp],
                        ['empOp', empOp],
                        ['rentalOp', rentalOp],
                        ['etcOp', etcOp]
                      ] as const).map(([key, val]) => (
                        <td className="px-3 py-3" key={key}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1000}
                            value={val}
                            onChange={(e) => handleChange(p.uid, key, e.target.value)}
                            className="w-full h-11 px-3 rounded-md border border-neutral-300 shadow-sm
                                       text-[14px] text-right placeholder:text-neutral-400
                                       focus:outline-none focus:ring-2 focus:ring-[#2D91FF]/40"
                          />
                        </td>
                      ))}

                      <td className="px-3 py-3 text-right font-semibold text-green-700">
                        {(finalNet ?? 0).toLocaleString()}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {saved[p.uid] ? (
                          <span className="text-green-600">✅ 저장됨</span>
                        ) : (
                          <button
                            onClick={() => handleSave(p)}
                            className="h-11 px-4 rounded-md bg-blue-600 text-white text-[14px] font-semibold hover:bg-blue-700"
                          >
                            저장
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
