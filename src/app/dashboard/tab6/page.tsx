'use client'

import { useState } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import useRoleGuard from '@/hooks/useRoleGuard'

export default function Tab6() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [profitA, setProfitA] = useState<number | null>(null)
  const [profitB, setProfitB] = useState<number | null>(null)
  const [difference, setDifference] = useState<number | null>(null)

  const [inputs, setInputs] = useState({
    insEmp: 0,
    insInd: 0,
    rental: 0,
    etc: 0,
    tax: 0,
    card: 0,
    rent: 0,
    etcFixed: 0
  })

  const handleChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: Number(value) || 0 }))
  }

  const calculate = async () => {
    if (!startDate || !endDate) return alert('기간을 선택하세요.')

    console.log('📆 선택한 기간:', startDate, ' ~ ', endDate)

    const dailySnap = await getDocs(
      query(
        collection(db, 'DailyRecords'),
        where('deliveryDate', '>=', startDate),
        where('deliveryDate', '<=', endDate)
      )
    )

    let coupangRevenue = 0
    let driverCost = 0

    for (const docSnap of dailySnap.docs) {
      const d = docSnap.data()
      const total = d.totalCount || 0
      const routeId = `${d.route}_${d.coupangId}`.toUpperCase()
      console.log('⛳️ routeId:', routeId, '총건수:', total)

      const routeSnap = await getDocs(query(collection(db, 'Routes'), where('id', '==', routeId)))
      if (!routeSnap.empty) {
        const route = routeSnap.docs[0].data()
        const coupangUnit = route.coupangUnitPrice || 0
        const driverUnit = route.driverUnitPrice || 0
        console.log('✅ 단가 조회:', coupangUnit, driverUnit)
        coupangRevenue += total * coupangUnit
        driverCost += total * driverUnit
      } else {
        console.warn('❌ [단가 조회 실패] 해당 routeId를 찾을 수 없음:', routeId)
      }
    }

    const freshSnap = await getDocs(
      query(
        collection(db, 'ItkooFreshbackProfits'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
    )

    let freshIn = 0
    let freshOut = 0
    if (!freshSnap.empty) {
      const d = freshSnap.docs[0].data()
      freshIn = d.inputFreshback || 0
      freshOut = d.totalDriverFreshback || 0
    } else {
      console.warn('❌ 프레시백 정보 없음 (ItkooFreshbackProfits)')
    }

    const totalExpenseA = driverCost + freshOut + inputs.insEmp + inputs.insInd + inputs.rental + inputs.etc + inputs.tax + inputs.card + inputs.rent + inputs.etcFixed
    const totalRevenueA = coupangRevenue + freshIn
    const calcA = totalRevenueA - totalExpenseA
    console.log('📘 A 방식 계산:', {
      coupangRevenue,
      freshIn,
      driverCost,
      freshOut,
      공제: inputs,
      totalRevenueA,
      totalExpenseA,
      calcA
    })

    const payoutSnap = await getDocs(
      query(
        collection(db, 'ItkooPayouts'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
    )

    let totalFinalNet = 0
    payoutSnap.forEach(doc => {
      const v = doc.data().finalNet || 0
      totalFinalNet += v
      console.log('📗 B 방식 finalNet 항목:', v)
    })

    const calcB = totalFinalNet + (freshIn - freshOut) - (inputs.tax + inputs.card + inputs.rent + inputs.etcFixed)
    console.log('📗 B 방식 계산:', {
      totalFinalNet,
      freshIn,
      freshOut,
      고정비: inputs,
      calcB
    })

    setProfitA(calcA)
    setProfitB(calcB)
    setDifference(Math.abs(calcA - calcB))

    await setDoc(doc(db, 'ItkooFinalProfitSummary', `${startDate}_${endDate}`), {
      startDate,
      endDate,
      profitA: calcA,
      profitB: calcB,
      diff: Math.abs(calcA - calcB),
      inputs,
      createdAt: new Date()
    })
  }

  return (
    <div className="bg-gradient-to-tr from-gray-50 to-white min-h-screen text-gray-800">
      <TabNavigation />
      <main className="max-w-5xl mx-auto py-10 px-6">
        <h1 className="text-3xl font-bold text-blue-700 mb-8">💰 잇쿠 최종 손익 요약 (Tab6)</h1>
        <div className="flex gap-4 mb-6">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded w-40" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded w-40" />
          <button onClick={calculate} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded">계산 및 저장</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border rounded p-5 shadow">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">📘 계산 방식 A (Raw 실적 기반)</h2>
            {profitA !== null && <p className="text-xl text-blue-800 font-bold">{profitA.toLocaleString()} 원</p>}
          </div>
          <div className="bg-white border rounded p-5 shadow">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">📗 계산 방식 B (정산값 기반)</h2>
            {profitB !== null && <p className="text-xl text-green-700 font-bold">{profitB.toLocaleString()} 원</p>}
          </div>
        </div>

        {difference !== null && (
          <div className="mt-6 bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded shadow">
            📐 계산 결과 차이: <b>{difference.toLocaleString()} 원</b>
          </div>
        )}

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-5 rounded border">
            <h3 className="text-md font-semibold text-gray-600 mb-2">🧾 운영자 공제</h3>
            {[ 'insEmp', 'insInd', 'rental', 'etc' ].map(k => (
              <div key={k} className="flex justify-between items-center mb-2">
                <label className="w-32 capitalize">{k}</label>
                <input type="number" className="border p-1 rounded w-40 text-right" value={inputs[k as keyof typeof inputs]} onChange={e => handleChange(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="bg-gray-50 p-5 rounded border">
            <h3 className="text-md font-semibold text-gray-600 mb-2">🏢 고정비 / 세금</h3>
            {[ 'tax', 'card', 'rent', 'etcFixed' ].map(k => (
              <div key={k} className="flex justify-between items-center mb-2">
                <label className="w-32 capitalize">{k}</label>
                <input type="number" className="border p-1 rounded w-40 text-right" value={inputs[k as keyof typeof inputs]} onChange={e => handleChange(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
