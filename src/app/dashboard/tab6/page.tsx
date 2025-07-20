// 요약 테이블 추가
'use client'

import { useState } from 'react'
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

export default function Tab6() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [profitA, setProfitA] = useState<number | null>(null)
  const [profitB, setProfitB] = useState<number | null>(null)
  const [difference, setDifference] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [summary, setSummary] = useState<any | null>(null)

  const [inputs, setInputs] = useState({
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

    let insOpSum = 0
    let empOpSum = 0
    let rentalOpSum = 0
    let etcOpSum = 0
    let finalNetSum = 0

    payoutOpSnap.forEach(doc => {
      const data = doc.data()
      insOpSum += data.insOp || 0
      empOpSum += data.empOp || 0
      rentalOpSum += data.rentalOp || 0
      etcOpSum += data.etcOp || 0
      finalNetSum += data.finalNet || 0
    })

    const opDeduction = insOpSum + empOpSum + rentalOpSum + etcOpSum

    const totalExpenseA = driverCost + freshOut + opDeduction + inputs.tax + inputs.card + inputs.rent + inputs.etcFixed
    const totalRevenueA = coupangRevenue + freshIn
    const calcA = totalRevenueA - totalExpenseA

    const calcB = finalNetSum + (freshIn - freshOut) - (inputs.tax + inputs.card + inputs.rent + inputs.etcFixed)

    setProfitA(calcA)
    setProfitB(calcB)
    setDifference(Math.abs(calcA - calcB))

    setSummary({
      coupangRevenue,
      driverCost,
      itkooFee: coupangRevenue - driverCost,
      freshIn,
      freshOut,
      opDeduction,
      fixedCost: inputs.tax + inputs.card + inputs.rent + inputs.etcFixed,
      totalRevenueA,
      totalExpenseA,
      calcA,
      finalNetSum,
      calcB
    })

    const same = Math.abs(calcA - calcB) < 10
    if (same) {
      alert(`✅ 계산 완료! A와 B가 일치합니다. (${calcA.toLocaleString()}원)`)
    } else {
      alert(`⚠️ 계산 완료! A와 B가 일치하지 않습니다. 차이: ${Math.abs(calcA - calcB).toLocaleString()}원`)
    }
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
    <div className="bg-gradient-to-tr from-gray-50 to-white min-h-screen text-gray-800">
      <TabNavigation />
      <main className="max-w-5xl mx-auto py-10 px-6">
        <h1 className="text-3xl font-bold text-blue-700 mb-8">💰 잇쿠 최종 손익 요약 (Tab6)</h1>

        <section className="bg-white shadow rounded-lg p-6 border mb-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded w-40" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded w-40" />
            <button onClick={calculate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded">📊 계산</button>
            <button onClick={handleSave} className={`px-4 py-2 rounded text-white ${saved ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`} disabled={saved}>
              {saved ? '✅ 저장됨' : '💾 저장'}</button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border border-blue-300 rounded p-4">
              <h2 className="text-md font-semibold text-blue-800 mb-2">📘 계산 방식 A (Raw 실적 기반)</h2>
              {profitA !== null && <p className="text-2xl font-bold text-blue-900">{profitA.toLocaleString()} 원</p>}
            </div>
            <div className="bg-green-50 border border-green-300 rounded p-4">
              <h2 className="text-md font-semibold text-green-800 mb-2">📗 계산 방식 B (정산값 기반)</h2>
              {profitB !== null && <p className="text-2xl font-bold text-green-900">{profitB.toLocaleString()} 원</p>}
            </div>
          </div>

          {difference !== null && (
            <div className="mt-4 bg-yellow-100 border border-yellow-400 text-yellow-800 font-semibold p-3 rounded">
              📐 계산 결과 차이: {difference.toLocaleString()} 원
            </div>
          )}

          {summary && (
            <div className="mt-6 bg-gray-50 border border-gray-200 p-4 rounded shadow-sm text-sm">
              <h3 className="text-md font-semibold text-gray-700 mb-2">📋 요약 테이블</h3>
              <table className="w-full text-sm border">
                <tbody>
                  <tr><td className="border p-2">쿠팡 수익</td><td className="border p-2 text-right">{summary.coupangRevenue.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">기사 비용</td><td className="border p-2 text-right">{summary.driverCost.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">잇쿠 수수료 (차익)</td><td className="border p-2 text-right">{summary.itkooFee.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">프레시백 수익</td><td className="border p-2 text-right">{summary.freshIn.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">프레시백 지급</td><td className="border p-2 text-right">{summary.freshOut.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">운영자 공제 합계</td><td className="border p-2 text-right">{summary.opDeduction.toLocaleString()} 원</td></tr>
                  <tr><td className="border p-2">고정비 총합</td><td className="border p-2 text-right">{summary.fixedCost.toLocaleString()} 원</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-gray-50 p-5 rounded border">
          <h3 className="text-md font-semibold text-gray-600 mb-4">🏢 고정비 / 세금 (수기입력)</h3>
          {[ 'tax', 'card', 'rent', 'etcFixed' ].map(k => (
            <div key={k} className="flex justify-between items-center mb-3">
              <label className="w-32 capitalize font-medium text-gray-700">{k}</label>
              <input type="number" className="border p-1 rounded w-40 text-right" value={inputs[k as keyof typeof inputs]} onChange={e => handleChange(k, e.target.value)} />
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
