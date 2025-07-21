'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  getDoc,
  doc
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import useRoleGuard from '@/hooks/useRoleGuard'

interface RecordItem {
  route: string
  coupangId: string
  deliveryCount: number
  returnCount: number
  totalCount: number
  uid: string
  email: string
  name: string
}

export default function Tab10() {
  useRoleGuard('admin')

  const [selectedDate, setSelectedDate] = useState('')
  const [records, setRecords] = useState<Record<string, RecordItem[]>>({})
  const [userMap, setUserMap] = useState<Record<string, { email: string; name: string }>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [allChecked, setAllChecked] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchRecords = async () => {
    if (!selectedDate) return
    setSaved(false)

    const usersSnap = await getDocs(collection(db, 'Users'))
    const userMapTemp: Record<string, { email: string; name: string }> = {}
    usersSnap.forEach(doc => {
      const d = doc.data()
      userMapTemp[d.uid] = { email: d.email, name: d.name }
    })
    setUserMap(userMapTemp)

    const dailySnap = await getDocs(
      query(collection(db, 'DailyRecords'), where('deliveryDate', '==', selectedDate))
    )
    const grouped: Record<string, RecordItem[]> = {}
    dailySnap.forEach(doc => {
      const d = doc.data() as RecordItem
      if (!grouped[d.uid]) grouped[d.uid] = []
      grouped[d.uid].push(d)
    })
    setRecords(grouped)

    const newChecked: Record<string, boolean> = {}
    Object.keys(userMapTemp).forEach(uid => {
      newChecked[uid] = false
    })
    setChecked(newChecked)
    setAllChecked(false)
  }

  useEffect(() => {
    if (selectedDate) fetchRecords()
  }, [selectedDate])

  const handleCheck = (uid: string) => {
    const updated = { ...checked, [uid]: !checked[uid] }
    setChecked(updated)
    setAllChecked(Object.values(updated).every(v => v))
  }

  const handleSave = async () => {
    const inspectionRef = doc(db, 'Inspections', selectedDate)
    const inspectionSnap = await getDoc(inspectionRef)

    if (inspectionSnap.exists()) {
      alert('⚠️ 이미 검수 완료된 날짜입니다.')
      return
    }

    await setDoc(inspectionRef, {
      date: selectedDate,
      checked,
      completed: true,
      createdAt: new Date()
    })

    alert('✅ 전체 검수 결과 저장 완료')
    setSaved(true)
  }

  return (
    <div className="bg-white min-h-screen">
      <TabNavigation />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">🧾 Tab10: 기사 실적 검수</h1>

        <div className="flex gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">날짜 선택</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border p-2 rounded"
            />
          </div>
        </div>

        {selectedDate && (
          <div className="space-y-6">
            {Object.keys(userMap).map(uid => {
              const { name = '이름없음', email = '이메일없음' } = userMap[uid] || {}
              return (
                <div key={uid} className="border rounded-lg p-4 shadow-sm bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h2 className="text-md font-semibold text-gray-800">
                        {name} ({email})
                      </h2>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mr-2">검수 완료</label>
                      <input
                        type="checkbox"
                        checked={!!checked[uid]}
                        onChange={() => handleCheck(uid)}
                      />
                    </div>
                  </div>

                  {records[uid]?.length > 0 ? (
                    <table className="w-full text-sm border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border p-2">노선</th>
                          <th className="border p-2">쿠팡ID</th>
                          <th className="border p-2">배송</th>
                          <th className="border p-2">반품</th>
                          <th className="border p-2">총합</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records[uid].map((r, idx) => (
                          <tr key={idx}>
                            <td className="border p-2">{r.route}</td>
                            <td className="border p-2">{r.coupangId}</td>
                            <td className="border p-2 text-right">{r.deliveryCount}</td>
                            <td className="border p-2 text-right">{r.returnCount}</td>
                            <td className="border p-2 text-right">{r.totalCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-red-500 text-sm">❌ 실적 없음</p>
                  )}
                </div>
              )
            })}

            <div className="text-right">
              <button
                disabled={!allChecked || saved}
                onClick={handleSave}
                className={`mt-4 px-5 py-2 rounded text-white font-semibold ${
                  !allChecked || saved ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saved ? '✅ 저장됨' : '📦 전체 검수 결과 저장'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
