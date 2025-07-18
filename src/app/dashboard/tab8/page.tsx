'use client'

import { useEffect, useState, ChangeEvent } from 'react'
import { db } from '@/lib/firebase'
import {
  collection, doc, setDoc, getDocs, deleteDoc
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'

interface RouteEntry {
  id: string
  route: string
  coupangId: string
  type: '고정' | '백업'
  shift: '주간' | '야간'
  driverUnitPrice: number
  coupangUnitPrice: number
  startDate: string
  createdAt: Date
}

export default function Tab8() {
  useRoleGuard('admin')

  const [form, setForm] = useState({
    route: '',
    coupangId: '',
    type: '고정' as '고정' | '백업',
    shift: '주간' as '주간' | '야간',
    driverUnitPrice: '',
    coupangUnitPrice: '',
    startDate: '',
  })

  const [routes, setRoutes] = useState<RouteEntry[]>([])
  const [message, setMessage] = useState('')

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    const { route, coupangId, type, shift, driverUnitPrice, coupangUnitPrice, startDate } = form

    if (!route || !coupangId || !driverUnitPrice || !startDate) {
      setMessage('❗ 모든 필수 항목을 입력해주세요.')
      return
    }

    const routeKey = `${route.toLowerCase()}_${coupangId.toLowerCase()}`.toUpperCase()
    const docRef = doc(db, 'Routes', routeKey)

    await setDoc(docRef, {
      id: routeKey,
      route: route.trim(),
      coupangId: coupangId.trim(),
      type,
      shift,
      driverUnitPrice: Number(driverUnitPrice),
      coupangUnitPrice: coupangUnitPrice ? Number(coupangUnitPrice) : 0,
      startDate,
      createdAt: new Date()
    })

    setMessage('✅ 등록 완료')
    setForm({ route: '', coupangId: '', type: '고정', shift: '주간', driverUnitPrice: '', coupangUnitPrice: '', startDate: '' })
    loadRoutes()
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'Routes', id))
    loadRoutes()
  }

  const loadRoutes = async () => {
    const snap = await getDocs(collection(db, 'Routes'))
    const list: RouteEntry[] = snap.docs.map(doc => doc.data() as RouteEntry)
    setRoutes(list)
  }

  useEffect(() => {
    loadRoutes()
  }, [])

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6 text-blue-700">⚙️ 기사 노선 단가 등록 (tab8)</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-lg border border-gray-300 mb-8">
          <input name="route" placeholder="노선명 (예: A01)" value={form.route} onChange={handleChange}
            className="border p-2 rounded" />
          <input name="coupangId" placeholder="쿠팡ID" value={form.coupangId} onChange={handleChange}
            className="border p-2 rounded" />
          <select name="type" value={form.type} onChange={handleChange} className="border p-2 rounded">
            <option value="고정">고정</option>
            <option value="백업">백업</option>
          </select>
          <select name="shift" value={form.shift} onChange={handleChange} className="border p-2 rounded">
            <option value="주간">주간</option>
            <option value="야간">야간</option>
          </select>
          <input name="driverUnitPrice" placeholder="기사 단가 (원)" type="number" value={form.driverUnitPrice} onChange={handleChange}
            className="border p-2 rounded" />
          <input name="coupangUnitPrice" placeholder="쿠팡 단가 (선택)" type="number" value={form.coupangUnitPrice} onChange={handleChange}
            className="border p-2 rounded" />
          <input name="startDate" type="date" value={form.startDate} onChange={handleChange}
            className="border p-2 rounded" />
          <button onClick={handleSubmit} className="col-span-1 md:col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            등록하기
          </button>
        </div>

        {message && <p className="text-center text-green-600 font-semibold mb-4">{message}</p>}

        <h2 className="text-lg font-semibold mb-2">📋 등록된 노선 목록</h2>
        <table className="w-full text-sm border rounded">
          <thead className="bg-gray-100 text-center">
            <tr>
              <th className="border p-2">노선</th>
              <th className="border p-2">쿠팡ID</th>
              <th className="border p-2">유형</th>
              <th className="border p-2">주/야</th>
              <th className="border p-2">기사단가</th>
              <th className="border p-2">쿠팡단가</th>
              <th className="border p-2">시작일</th>
              <th className="border p-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="text-center">
                <td className="border p-1">{r.route}</td>
                <td className="border p-1">{r.coupangId}</td>
                <td className="border p-1">{r.type}</td>
                <td className="border p-1">{r.shift}</td>
                <td className="border p-1">{r.driverUnitPrice.toLocaleString()}</td>
                <td className="border p-1">{r.coupangUnitPrice?.toLocaleString()}</td>
                <td className="border p-1">{r.startDate}</td>
                <td className="border p-1">
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
