// src/app/dashboard/tab6/page.tsx
'use client'

import { useState, useEffect } from 'react'
import TabNavigation from '@/components/TabNavigation'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from 'firebase/firestore'

export default function Tab6() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalFee, setTotalFee] = useState(0)
  const [driverIncome, setDriverIncome] = useState(0)
  const [finalNetSum, setFinalNetSum] = useState(0)
  const [freshbackIn, setFreshbackIn] = useState(0)
  const [freshbackOut, setFreshbackOut] = useState(0)

  const [insEmp, setInsEmp] = useState(0)
  const [insInd, setInsInd] = useState(0)
  const [rental, setRental] = useState(0)
  const [tax, setTax] = useState(0)
  const [card, setCard] = useState(0)

  const loadData = async () => {
    if (!startDate || !endDate) return

    // 총 수익 (쿠팡 totalFee)와 기사 수익 총합
    const payoutSnap = await getDocs(query(
      collection(db, 'FinalPayouts'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    ))
    let total = 0
    let driverSum = 0
    payoutSnap.forEach(doc => {
      const d = doc.data()
      total += d.totalFee || 0
      driverSum += d.driverIncome || 0
    })
    setTotalFee(total)
    setDriverIncome(driverSum)

    // tab4 저장값 기반 최종 수익
    const netSnap = await getDocs(query(
      collection(db, 'ItkooPayouts'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    ))
    let sum = 0
    netSnap.forEach(doc => {
      const d = doc.data()
      sum += d.finalNet || 0
    })
    setFinalNetSum(sum)

    // 프레시백 지급 합계 불러오기
    const freshbackSnap = await getDocs(query(
      collection(db, 'ItkooFreshbackProfits'),
      where('startDate', '==', startDate),
      where('endDate', '==', endDate)
    ))
    if (!freshbackSnap.empty) {
      const d = freshbackSnap.docs[0].data()
      setFreshbackIn(d.freshbackTotal || 0)
      setFreshbackOut(d.totalDriverFreshback || 0)
    }
  }

  const totalDeductions = insEmp + insInd + rental
  const otherCosts = tax + card

  const profitA = (totalFee - driverIncome) + (freshbackIn - freshbackOut) - totalDeductions - otherCosts
  const profitB = finalNetSum + (freshbackIn - freshbackOut) - otherCosts

  const diff = Math.abs(profitA - profitB)

  const handleSave = async () => {
    if (!startDate || !endDate) return
    await setDoc(doc(db, 'ItkooFinalProfitSummary', `${startDate}_${endDate}`), {
      startDate,
      endDate,
      profitA,
      profitB,
      diff,
      totalFee,
      driverIncome,
      finalNetSum,
      freshbackIn,
      freshbackOut,
      deductions: { insEmp, insInd, rental },
      otherCosts: { tax, card },
      createdAt: new Date()
    })
    alert('✅ 최종 순수익 저장 완료')
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <TabNavigation />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-blue-800">💰 잇쿠 최종 순수익 계산 (Tab6)</h1>

        <div className="flex gap-4 mb-4">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded" />
          <button onClick={loadData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">불러오기</button>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded shadow">
          <div>
            <h2 className="font-semibold text-lg mb-2">📘 계산 방식 A (Raw)</h2>
            <p>수익: {(totalFee - driverIncome).toLocaleString()} + 프레시백 차익: {(freshbackIn - freshbackOut).toLocaleString()}</p>
            <p>공제: {totalDeductions.toLocaleString()} / 기타비용: {otherCosts.toLocaleString()}</p>
            <p className="mt-2 text-xl font-bold text-blue-700">= {profitA.toLocaleString()} 원</p>
          </div>

          <div>
            <h2 className="font-semibold text-lg mb-2">📗 계산 방식 B (tab4 저장값 기반)</h2>
            <p>합계 finalNet: {finalNetSum.toLocaleString()} + 프레시백 차익: {(freshbackIn - freshbackOut).toLocaleString()}</p>
            <p>기타비용: {otherCosts.toLocaleString()}</p>
            <p className="mt-2 text-xl font-bold text-green-700">= {profitB.toLocaleString()} 원</p>
          </div>
        </div>

        {diff > 0 && (
          <p className="mt-4 text-red-600 font-semibold">⚠️ 두 방식 결과 차이: {diff.toLocaleString()} 원</p>
        )}

        <div className="mt-6 bg-gray-100 p-4 rounded grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">산재보험</label>
            <input type="number" value={insEmp} onChange={(e) => setInsEmp(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
            <label className="block text-sm font-medium text-gray-700 mt-2">고용보험</label>
            <input type="number" value={insInd} onChange={(e) => setInsInd(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
            <label className="block text-sm font-medium text-gray-700 mt-2">용차비</label>
            <input type="number" value={rental} onChange={(e) => setRental(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">세금</label>
            <input type="number" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
            <label className="block text-sm font-medium text-gray-700 mt-2">카드값</label>
            <input type="number" value={card} onChange={(e) => setCard(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
          </div>
        </div>

        <div className="mt-6 text-right">
          <button onClick={handleSave} className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800">✅ 최종 저장</button>
        </div>
      </main>
    </div>
  )
}
