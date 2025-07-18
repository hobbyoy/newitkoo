'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import useRoleGuard from '@/hooks/useRoleGuard'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'

interface Driver {
  uid: string
  email: string
  name: string
}

interface Route {
  routeCode: string
  coupangId: string
  shift: string
}

export default function Tab1() {
  useRoleGuard('admin')

  const [driverList, setDriverList] = useState<Driver[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [allRoutes, setAllRoutes] = useState<Route[]>([])

  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    route: '',
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })

  const [message, setMessage] = useState('')

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    const { date, coupangId, route, shift, deliveryCount, returnCount } = form
    if (!selectedUid || !date || !coupangId || !route || !shift) {
      alert('❗ 모든 항목을 입력해주세요.')
      return
    }

    const selectedDriver = driverList.find((d) => d.uid === selectedUid)
    if (!selectedDriver) {
      alert('❌ 선택된 기사 정보가 없습니다.')
      return
    }

    const key = `${selectedUid}|${date}|${coupangId.toLowerCase()}|${route.toLowerCase()}`
    const docRef = doc(db, 'DailyRecords', key)
    const existing = await getDoc(docRef)
    if (existing.exists()) {
      alert('⚠️ 동일한 실적이 이미 존재합니다.')
      return
    }

    const routeKey = `${route.toLowerCase()}_${coupangId.toLowerCase()}`.toUpperCase()
    const routeCheck = await getDoc(doc(db, 'Routes', routeKey))
    if (!routeCheck.exists()) {
      alert(`❌ 등록되지 않은 노선입니다.\n\n노선코드: ${route} / 쿠팡ID: ${coupangId}`)
      return
    }

    try {
      await setDoc(docRef, {
        uid: selectedUid,
        email: selectedDriver.email,
        name: selectedDriver.name,
        deliveryDate: date,
        coupangId: coupangId.toLowerCase(),
        route: route.toLowerCase(),
        shift,
        deliveryCount: Number(deliveryCount),
        returnCount: Number(returnCount),
        totalCount: Number(deliveryCount) + Number(returnCount),
        createdAt: serverTimestamp(),
      })

      setMessage('✅ 실적이 저장되었습니다.')
      setForm({
        date: '',
        coupangId: '',
        route: '',
        shift: '',
        deliveryCount: '',
        returnCount: '',
      })
    } catch (err) {
      if (err instanceof Error) {
        console.error(err)
        setMessage(`❌ 저장 실패: ${err.message}`)
      }
    }
  }

  const fetchDrivers = async () => {
    const snap = await getDocs(collection(db, 'Users'))
    const drivers = snap.docs.map(doc => doc.data() as Driver)
    setDriverList(drivers)
  }

  const fetchRoutes = async () => {
    const snap = await getDocs(collection(db, 'Routes'))
    const routes = snap.docs.map(doc => doc.data() as Route)
    setAllRoutes(routes)
  }

  useEffect(() => {
    fetchDrivers()
    fetchRoutes()
  }, [])

  return (
    <div>
      <TabNavigation />

      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6 text-blue-600">📥 운영자 실적 입력 (tab1)</h1>

        <div className="mb-4">
          <label className="block mb-1 text-sm font-semibold">기사 선택</label>
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="">기사 선택</option>
            {driverList.map((driver) => (
              <option key={driver.uid} value={driver.uid}>
                {driver.email} / {driver.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm">배송일자</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} className="border p-2 w-full" />
          </div>

          <div>
            <label className="block text-sm">쿠팡 ID</label>
            <input name="coupangId" type="text" value={form.coupangId} onChange={handleChange} className="border p-2 w-full" />
          </div>

          <div>
            <label className="block text-sm">노선명</label>
            <input name="route" type="text" value={form.route} onChange={handleChange} className="border p-2 w-full" />
          </div>

          <div>
            <label className="block text-sm">주/야</label>
            <select name="shift" value={form.shift} onChange={handleChange} className="border p-2 w-full">
              <option value="">선택</option>
              <option value="주간">주간</option>
              <option value="야간">야간</option>
            </select>
          </div>

          <div>
            <label className="block text-sm">배송 건수</label>
            <input name="deliveryCount" type="number" value={form.deliveryCount} onChange={handleChange} className="border p-2 w-full" />
          </div>

          <div>
            <label className="block text-sm">반품 건수</label>
            <input name="returnCount" type="number" value={form.returnCount} onChange={handleChange} className="border p-2 w-full" />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
        >
          실적 저장
        </button>

        {message && <p className="mt-4 text-center text-sm text-green-600 font-semibold whitespace-pre-wrap">{message}</p>}

        {allRoutes.length > 0 && (
          <div className="mt-10 border rounded p-4 bg-gray-50">
            <h2 className="text-sm font-semibold text-green-700 mb-2">📋 전체 등록된 노선 정보</h2>
            <table className="w-full text-xs text-center border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1">노선코드</th>
                  <th className="border p-1">쿠팡ID</th>
                  <th className="border p-1">주/야</th>
                </tr>
              </thead>
              <tbody>
                {allRoutes.map((r, i) => (
                  <tr key={i}>
                    <td className="border p-1">{r.routeCode}</td>
                    <td className="border p-1">{r.coupangId}</td>
                    <td className="border p-1">{r.shift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
