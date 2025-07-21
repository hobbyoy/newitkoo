// 전체 UX 흐름 개선 + 날짜 변경 시 자동 계산 + 고정비 입력 위로 이동
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
  getDoc
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import useRoleGuard from '@/hooks/useRoleGuard'

interface SummaryData {
  coupangRevenue: number
  driverCost: number
  itkooFee: number
  freshIn: number
  freshOut: number
  opDeductions: {
    insOp: number
    empOp: number
    rentalOp: number
    etcOp: number
  }
  fixedCosts: {
    tax: number
    card: number
    rent: number
    etcFixed: number
  }
  totalRevenueA: number
  totalExpenseA: number
  calcA: number
  finalNetSum: number
  calcB: number
}

export default function Tab6() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [profitA, setProfitA] = useState<number | null>(null)
  const [profitB, setProfitB] = useState<number | null>(null)
  const [difference, setDifference] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [summary, setSummary] = useState<SummaryData | null>(null)

  const [inputs, setInputs] = useState({
    tax: 0,
    card: 0,
    rent: 0,
    etcFixed: 0
  })

  const handleChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: Number(value) || 0 }))
  }

  const autoTriggerCalculation = async () => {
    if (!startDate || !endDate) return
    await calculate()
  }

  useEffect(() => {
    autoTriggerCalculation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const calculate = async () => {
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
      const routeSnap = await getDocs(query(collection(db, 'Routes'), where('id', '==', routeId)))
      if (!routeSnap.empty) {
        const route = routeSnap.docs[0].data()
        coupangRevenue += total * (route.coupangUnitPrice || 0)
        driverCost += total * (route.driverUnitPrice || 0)
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
    }

    const payoutOpSnap = await getDocs(
      query(
        collection(db, 'ItkooPayouts'),
        where('startDate', '==', startDate),
        where('endDate', '==', endDate)
      )
    )

    let insOp = 0
    let empOp = 0
    let rentalOp = 0
    let etcOp = 0
    let finalNetSum = 0

    payoutOpSnap.forEach(doc => {
      const data = doc.data()
      insOp += data.insOp || 0
      empOp += data.empOp || 0
      rentalOp += data.rentalOp || 0
      etcOp += data.etcOp || 0
      finalNetSum += data.finalNet || 0
    })

    const opDeduction = insOp + empOp + rentalOp + etcOp
    const fixedCost = inputs.tax + inputs.card + inputs.rent + inputs.etcFixed

    const totalExpenseA = driverCost + freshOut + opDeduction + fixedCost
    const totalRevenueA = coupangRevenue + freshIn
    const calcA = totalRevenueA - totalExpenseA
    const calcB = finalNetSum + (freshIn - freshOut) - fixedCost

    setProfitA(calcA)
    setProfitB(calcB)
    setDifference(Math.abs(calcA - calcB))

    setSummary({
      coupangRevenue,
      driverCost,
      itkooFee: coupangRevenue - driverCost,
      freshIn,
      freshOut,
      opDeductions: { insOp, empOp, rentalOp, etcOp },
      fixedCosts: { ...inputs },
      totalRevenueA,
      totalExpenseA,
      calcA,
      finalNetSum,
      calcB
    })
  }

  const handleSave = async () => {
    if (!startDate || !endDate || profitA === null || profitB === null || difference === null) return alert('먼저 계산을 수행해주세요.')
    const ref = doc(db, 'ItkooFinalProfitSummary', `${startDate}_${endDate}`)
    const exists = await getDoc(ref)
    if (exists.exists()) {
      alert('⚠️ 이미 저장된 기간입니다.')
      return
    }
    try {
      await setDoc(ref, {
        startDate,
        endDate,
        profitA,
        profitB,
        diff: difference,
        inputs,
        createdAt: new Date()
      })
      alert('✅ 저장 완료!')
      setSaved(true)
    } catch (err) {
      console.error(err)
      alert('❌ 저장 실패')
    }
  }

  return (
    <div className="bg-white min-h-screen">
      <TabNavigation />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-6">💰 잇쿠 최종 손익 요약 (Tab6)</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm font-semibold">시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="text-sm font-semibold">종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border p-2 rounded" />
          </div>
        </div>

        <div className="bg-gray-50 border p-4 rounded-lg mb-6">
          <h2 className="text-md font-semibold text-gray-700 mb-2">🏢 고정비 / 세금 입력</h2>
          <div className="grid grid-cols-2 gap-4">
            {['tax', 'card', 'rent', 'etcFixed'].map(k => (
              <div key={k} className="flex justify-between items-center">
                <label className="capitalize text-gray-600 font-medium w-24">{k}</label>
                <input
                  type="number"
                  className="border p-1 rounded w-32 text-right"
                  value={inputs[k as keyof typeof inputs]}
                  onChange={e => handleChange(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex gap-4">
          <button onClick={calculate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">📊 재계산</button>
          <button onClick={handleSave} disabled={saved} className={`px-4 py-2 rounded text-white ${saved ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
            {saved ? '✅ 저장됨' : '💾 저장'}
          </button>
        </div>

        {summary && (
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="bg-white border p-4 rounded-xl shadow">
              <h2 className="font-semibold text-blue-700 mb-2">📈 수익 항목</h2>
              <ul className="space-y-1">
                <li className="flex justify-between"><span>쿠팡 수익</span><span>{summary.coupangRevenue.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>프레시백 수익</span><span>{summary.freshIn.toLocaleString()} 원</span></li>
              
              </ul>
            </div>
            <div className="bg-white border p-4 rounded-xl shadow">
              <h2 className="font-semibold text-red-700 mb-2">📉 비용 항목</h2>
              <ul className="space-y-1">
                <li className="flex justify-between"><span>- 기사 수익</span><span>-{summary.driverCost.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 프레시백 지급</span><span>-{summary.freshOut.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 산재보험</span><span>-{summary.opDeductions.insOp.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 고용보험</span><span>-{summary.opDeductions.empOp.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 용차비</span><span>-{summary.opDeductions.rentalOp.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 기타 공제</span><span>-{summary.opDeductions.etcOp.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 세금</span><span>-{summary.fixedCosts.tax.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 카드</span><span>-{summary.fixedCosts.card.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 고정비</span><span>-{summary.fixedCosts.rent.toLocaleString()} 원</span></li>
                <li className="flex justify-between"><span>- 기타</span><span>-{summary.fixedCosts.etcFixed.toLocaleString()} 원</span></li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl shadow md:col-span-2">
              <h2 className="font-semibold text-green-800 mb-2">📊 계산 결과</h2>
              <div className="grid grid-cols-2 text-sm gap-2">
                <div className="flex justify-between"><span>총 수익 (A)</span><span>{summary.totalRevenueA.toLocaleString()} 원</span></div>
                <div className="flex justify-between"><span>총 비용 (A)</span><span>{summary.totalExpenseA.toLocaleString()} 원</span></div>
                <div className="flex justify-between font-bold text-blue-700 text-lg mt-2"><span>최종 수익 A</span><span>{summary.calcA.toLocaleString()} 원</span></div>
                <div className="flex justify-between font-bold text-green-700 text-lg mt-2"><span>최종 수익 B</span><span>{summary.calcB.toLocaleString()} 원</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}