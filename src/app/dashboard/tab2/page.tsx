'use client'

import { useState, useEffect } from 'react'
import useRoleGuard from '@/hooks/useRoleGuard'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'

interface DailyRecord {
  uid: string
  email: string
  name: string
  route: string
  coupangId: string
  deliveryCount: number
  returnCount: number
}

interface RouteUnit {
  coupangUnitPrice: number
  driverUnitPrice: number
}

interface DriverSummary {
  uid: string
  email: string
  name: string
  routes: Set<string>
  ids: Set<string>
  totalDelivery: number
  totalReturn: number
  totalCount: number
  totalIncome: number
  driverIncome: number
  itkooFee: number
  routeDetails: {
    route: string
    coupangId: string
    deliveryCount: number
    returnCount: number
    totalCount: number
    totalIncome: number
    driverIncome: number
    itkooFee: number
  }[]
}

export default function Tab2() {
  useRoleGuard('admin')

  const [records, setRecords] = useState<DailyRecord[]>([])
  const [summary, setSummary] = useState<DriverSummary[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    if (!startDate || !endDate) return

    const q = query(
      collection(db, 'DailyRecords'),
      where('deliveryDate', '>=', startDate),
      where('deliveryDate', '<=', endDate)
    )
    const snapshot = await getDocs(q)
    const raw: DailyRecord[] = []
    snapshot.forEach((doc) => raw.push(doc.data() as DailyRecord))
    setRecords(raw)

    const driverMap: Record<string, DriverSummary> = {}

    for (const item of raw) {
      const key = item.uid
      if (!driverMap[key]) {
        driverMap[key] = {
          uid: key,
          email: item.email || '',
          name: item.name || '',
          routes: new Set(),
          ids: new Set(),
          totalDelivery: 0,
          totalReturn: 0,
          totalCount: 0,
          totalIncome: 0,
          driverIncome: 0,
          itkooFee: 0,
          routeDetails: []
        }
      }

      const deliveryCount = Number(item.deliveryCount || 0)
      const returnCount = Number(item.returnCount || 0)
      const totalCount = deliveryCount + returnCount

      const routeId = `${item.route}_${item.coupangId}`.toUpperCase()
      const unitSnap = await getDoc(doc(db, 'Routes', routeId))
      const units = unitSnap.exists() ? (unitSnap.data() as RouteUnit) : { coupangUnitPrice: 0, driverUnitPrice: 0 }

      const totalIncome = totalCount * units.coupangUnitPrice
      const driverIncome = totalCount * units.driverUnitPrice
      const itkooFee = totalIncome - driverIncome

      driverMap[key].routes.add(item.route)
      driverMap[key].ids.add(item.coupangId)

      driverMap[key].totalDelivery += deliveryCount
      driverMap[key].totalReturn += returnCount
      driverMap[key].totalCount += totalCount
      driverMap[key].totalIncome += totalIncome
      driverMap[key].driverIncome += driverIncome
      driverMap[key].itkooFee += itkooFee

      driverMap[key].routeDetails.push({
        route: item.route,
        coupangId: item.coupangId,
        deliveryCount,
        returnCount,
        totalCount,
        totalIncome,
        driverIncome,
        itkooFee
      })
    }

    setSummary(Object.values(driverMap))
  }

  useEffect(() => {
    if (startDate && endDate) loadData()
  }, [startDate, endDate])

  return (
    <div>
      <TabNavigation />

      <main className="p-6">
        <h1 className="text-xl font-bold mb-4">📊 기사별 실적 요약 (tab2)</h1>

        <div className="mb-4 flex gap-4">
          <div>
            <label>시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2" />
          </div>
          <div>
            <label>종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2" />
          </div>
        </div>

        {summary.map((driver) => (
          <div key={driver.uid} className="mb-8 border p-4 rounded">
            <h2 className="font-bold text-blue-600 mb-2">
              👷 {driver.email} / {driver.name}
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              운행 노선: {Array.from(driver.routes).join(', ')}<br />
              사용 쿠팡ID: {Array.from(driver.ids).join(', ')}
            </p>

            <table className="w-full text-sm mb-2 border">
              <thead>
                <tr className="bg-gray-200 text-center">
                  <th>노선</th>
                  <th>쿠팡ID</th>
                  <th>배송</th>
                  <th>반품</th>
                  <th>총건수</th>
                  <th>총수익</th>
                  <th>기사수익</th>
                  <th>잇쿠수수료</th>
                </tr>
              </thead>
              <tbody>
                {driver.routeDetails.map((detail, idx) => (
                  <tr key={idx} className="text-center">
                    <td>{detail.route}</td>
                    <td>{detail.coupangId}</td>
                    <td>{detail.deliveryCount}</td>
                    <td>{detail.returnCount}</td>
                    <td>{detail.totalCount}</td>
                    <td>{detail.totalIncome.toLocaleString()}원</td>
                    <td>{detail.driverIncome.toLocaleString()}원</td>
                    <td>{detail.itkooFee.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-sm mt-2 font-semibold">
              📦 총 배송: {driver.totalDelivery}건 / 반품: {driver.totalReturn}건 / 총건수: {driver.totalCount}건<br />
              💰 총수익: {driver.totalIncome.toLocaleString()}원 / 기사수익: {driver.driverIncome.toLocaleString()}원 / 잇쿠수수료: {driver.itkooFee.toLocaleString()}원
            </p>
          </div>
        ))}
      </main>
    </div>
  )
}
