// ✅ tab1 전체 코드 - 커스텀 드롭다운 + 뉴모피즘 테이블 적용
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

interface Route {
  route: string
  coupangId: string
  shift: string
  uid?: string
}

export default function Tab1() {
  useRoleGuard('admin')

  const [driverList, setDriverList] = useState<Driver[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [allRoutes, setAllRoutes] = useState<Route[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

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
      setSelectedUid('')
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

      <main className="max-w-md mx-auto py-10 px-4">
        <h1 className="text-xl font-semibold text-center text-[#0088FF] mb-6">📥 운영자 실적 입력</h1>

        {/* 기사 선택 드롭다운 */}
        <div className="mb-4 relative">
          <label className="text-sm text-gray-700 font-medium mb-1 block">기사 선택</label>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full border rounded-md shadow-sm text-left text-sm text-[#0088FF] font-semibold bg-white relative"
          >
            {selectedDriver ? `${selectedDriver.name} / ${selectedDriver.email}` : 'Pick an option'}
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

        {/* 입력 폼 */}
        <div className="space-y-4">
          <input name="date" type="date" value={form.date} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="배송일자" />
          <input name="coupangId" type="text" value={form.coupangId} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="쿠팡 ID" />
          <input name="route" type="text" value={form.route} onChange={handleChange} className="w-full h-11 px-3 py-2 text-sm border rounded-md shadow-sm" placeholder="노선명" />

          <div>
            <label className="text-sm text-gray-700 font-medium mb-1 block">주/야</label>
            <ToggleGroup
              type="single"
              value={form.shift}
              onValueChange={(value) => setForm({ ...form, shift: value || '' })}
              className="w-full h-11 px-3 border rounded-md rounded-md overflow-hidden"
            >
              <ToggleGroupItem value="주간" className="flex-1 h-11 text-sm font-medium data-[state=on]:bg-[#0088FF] data-[state=on]:text-white">주간</ToggleGroupItem>
              <ToggleGroupItem value="야간" className="flex-1 h-11 text-sm font-medium data-[state=on]:bg-[#0088FF] data-[state=on]:text-white">야간</ToggleGroupItem>
            </ToggleGroup>
          </div>

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

        {/* 뉴모피즘 테이블 */}
        {allRoutes.length > 0 && (
          <div className="mt-10 bg-white/50 backdrop-blur-md shadow-inner border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#0088FF] mb-4">📋 등록된 기사 노선 정보</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 rounded-lg">
                <thead>
                  <tr className="bg-white/40 backdrop-blur-md text-left text-[#0088FF] font-semibold tracking-wide">
                    <th className="px-4 py-3">기사</th>
                    <th className="px-4 py-3">노선명</th>
                    <th className="px-4 py-3">쿠팡ID</th>
                    <th className="px-4 py-3">주/야</th>
                  </tr>
                </thead>
                <tbody>
                  {allRoutes.map((r, i) => (
                    <tr
                      key={i}
                      className={`${
                        i % 2 === 0 ? 'bg-white/60' : 'bg-white/30'
                      } hover:bg-white/70 transition`}
                    >
                      <td className="px-4 py-3">{driverList.find(d => d.uid === r.uid)?.name || 'N/A'}</td>
                      <td className="px-4 py-3 font-medium">{r.route}</td>
                      <td className="px-4 py-3">{r.coupangId}</td>
                      <td className="px-4 py-3">{r.shift}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
