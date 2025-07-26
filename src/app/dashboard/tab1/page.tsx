// ✅ tab1 전체 코드 - 기사 실적을 DailyRecords에 저장하는 구조 + 기사 노선 정보 표시
'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import useRoleGuard from '@/hooks/useRoleGuard'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface Driver {
  uid: string
  email: string
  name: string
}

interface RouteEntry {
  id: string
  route: string
  coupangId: string
  type: '고정' | '백업'
  shift: '주간' | '야간'
  driverEmail: string
}

export default function Tab1() {
  useRoleGuard('admin')

  const [driverList, setDriverList] = useState<Driver[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [routes, setRoutes] = useState<RouteEntry[]>([])

  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    route: '',
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })

  const [message, setMessage] = useState('')

  const selectedDriver = driverList.find((d) => d.uid === selectedUid)
  const filteredRoutes = selectedDriver ? routes.filter(r => r.driverEmail === selectedDriver.email) : []

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    const { date, coupangId, route, shift, deliveryCount, returnCount } = form
    if (!selectedUid || !date || !coupangId || !route || !shift) {
      alert('❗ 모든 항목을 입력해주세요.')
      return
    }

    if (!selectedDriver) {
      alert('❌ 선택된 기사 정보가 없습니다.')
      return
    }

    const key = `${selectedUid}|${date}|${coupangId.toLowerCase()}|${route.toLowerCase()}`
    const docRef = doc(db, 'DailyRecords', key)
    const exists = await getDoc(docRef)
    if (exists.exists()) {
      alert('⚠️ 이미 입력된 실적입니다.')
      return
    }

    const routeKey = `${route.toLowerCase()}_${coupangId.toLowerCase()}`.toUpperCase()
    const routeCheck = await getDoc(doc(db, 'Routes', routeKey))
    if (!routeCheck.exists()) {
      alert(`❌ 등록되지 않은 노선입니다.\n\n노선: ${route} / 쿠팡ID: ${coupangId}`)
      return
    }

    try {
      const delivery = Number(deliveryCount || 0)
      const returns = Number(returnCount || 0)
      const total = delivery + returns

      await setDoc(docRef, {
        uid: selectedUid,
        email: selectedDriver.email,
        name: selectedDriver.name,
        deliveryDate: date,
        coupangId: coupangId.toLowerCase(),
        route: route.toLowerCase(),
        shift,
        deliveryCount: delivery,
        returnCount: returns,
        totalCount: total,
        createdAt: serverTimestamp(),
      })

      setMessage('✅ 실적이 성공적으로 저장되었습니다.')
      setForm({
        date: '',
        coupangId: '',
        route: '',
        shift: '',
        deliveryCount: '',
        returnCount: '',
      })
      setSelectedUid('')
    } catch (err) {
      console.error(err)
      setMessage('❌ 저장 실패')
    }
  }

  const fetchDrivers = async () => {
    const snap = await getDocs(collection(db, 'Users'))
    const drivers = snap.docs.map(doc => doc.data() as Driver)
    setDriverList(drivers)
  }

  const fetchRoutes = async () => {
    const snap = await getDocs(collection(db, 'Routes'))
    const list = snap.docs.map(doc => doc.data() as RouteEntry)
    setRoutes(list)
  }

  useEffect(() => {
    fetchDrivers()
    fetchRoutes()
  }, [])

  return (
    <div>
      <TabNavigation />

      <main className="max-w-md mx-auto py-10 px-4">
        <h1 className="text-xl font-semibold text-center text-[#0088FF] mb-6">📥 운영자 실적 입력</h1>

        {/* 기사 선택 드롭다운 */}
        <div className="mb-4 relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm text-left font-medium bg-white relative"
          >
            {selectedDriver ? `${selectedDriver.name} / ${selectedDriver.email}` : '기사선택'}
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="#0088FF" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          {dropdownOpen && (
            <ul className="absolute z-10 mt-2 w-full max-h-60 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg">
              {driverList.map((driver) => (
                <li
                  key={driver.uid}
                  onClick={() => {
                    setSelectedUid(driver.uid)
                    setDropdownOpen(false)
                  }}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-[#0088FF]/20 hover:text-[#0088FF] transition-colors"
                >
                  {driver.name} / {driver.email}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 해당 기사 노선 목록 테이블 */}
        {selectedDriver && filteredRoutes.length > 0 && (
          <div className="mb-6 border p-4 rounded bg-white shadow-sm">
            <h2 className="text-sm font-semibold text-[#0088FF] mb-2">📋 해당 기사 노선 정보</h2>
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-100 text-center">
                <tr>
                  <th className="border p-2">노선명</th>
                  <th className="border p-2">쿠팡ID</th>
                  <th className="border p-2">유형</th>
                  <th className="border p-2">주/야</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((r, i) => (
                  <tr key={i} className="text-center">
                    <td className="border p-1">{r.route}</td>
                    <td className="border p-1">{r.coupangId}</td>
                    <td className="border p-1">{r.type}</td>
                    <td className="border p-1">{r.shift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 입력 폼 */}
        <div className="space-y-4">
          <input name="date" type="date" value={form.date} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="배송일자" />
          <input name="coupangId" type="text" value={form.coupangId} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="쿠팡 ID" />
          <input name="route" type="text" value={form.route} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="노선명" />

          <ToggleGroup
            type="single"
            value={form.shift}
            onValueChange={(value) => setForm({ ...form, shift: value || '' })}
            className="flex w-full border rounded-md shadow-sm overflow-hidden"
          >
            <ToggleGroupItem value="주간" className="flex-1 h-11 px-3 py-2 text-sm font-medium flex items-center justify-center data-[state=on]:bg-[#0088FF] data-[state=on]:text-white">주간</ToggleGroupItem>
            <ToggleGroupItem value="야간" className="flex-1 h-11 px-3 py-2 text-sm font-medium flex items-center justify-center data-[state=on]:bg-[#0088FF] data-[state=on]:text-white">야간</ToggleGroupItem>
          </ToggleGroup>

          <input name="deliveryCount" type="number" value={form.deliveryCount} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="배송 건수" />
          <input name="returnCount" type="number" value={form.returnCount} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="반품 건수" />
        </div>

        <button
          onClick={handleSubmit}
          className="mt-6 w-full h-11 rounded-md border text-sm font-semibold bg-[#0088FF] text-white shadow-md hover:brightness-110"
        >
          저장하기
        </button>

        {message && <p className="text-green-600 text-sm font-semibold text-center whitespace-pre-wrap mt-4">{message}</p>}
      </main>
    </div>
  )
}
