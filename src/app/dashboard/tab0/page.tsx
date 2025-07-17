'use client'

import { useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'

export default function Tab0() {
  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    route: '',
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })

  const [totalCount, setTotalCount] = useState(0)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updatedForm = { ...form, [name]: value }

    const delivery = Number(updatedForm.deliveryCount || 0)
    const returns = Number(updatedForm.returnCount || 0)
    setTotalCount(delivery + returns)

    setForm(updatedForm)
    setErrors((prev) => ({ ...prev, [name]: false }))
  }

  const handleSubmit = async () => {
    const newErrors: { [key: string]: boolean } = {}
    if (!form.date) newErrors.date = true
    if (!form.coupangId) newErrors.coupangId = true
    if (!form.route) newErrors.route = true
    if (!form.shift) newErrors.shift = true

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setMessage('❗ 필수 입력 항목을 모두 작성해 주세요.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setMessage('❌ 로그인 상태가 아닙니다.')
      return
    }

    const uid = user.uid
    const email = user.email || ''

    const userDoc = await getDoc(doc(db, 'Users', uid))
    if (!userDoc.exists()) {
      setMessage('❌ 사용자 정보가 없습니다.')
      return
    }

    const name = userDoc.data()?.name || ''

    const key = `${uid}|${form.date}|${form.coupangId.toLowerCase()}|${form.route.toLowerCase()}`
    const docRef = doc(db, 'DailyRecords', key)
    const existing = await getDoc(docRef)
    if (existing.exists()) {
      setMessage('⚠️ 이미 입력된 실적입니다.')
      return
    }

    const routeKey = `${form.route.toLowerCase()}_${form.coupangId.toLowerCase()}`.toUpperCase()
    const routeCheck = await getDoc(doc(db, 'Routes', routeKey))
    if (!routeCheck.exists()) {
      setMessage(`❌ 등록되지 않은 노선입니다.\n\n노선코드: ${form.route} / 쿠팡ID: ${form.coupangId}`)
      return
    }

    try {
      await setDoc(docRef, {
        uid,
        email,
        name,
        deliveryDate: form.date,
        coupangId: form.coupangId.toLowerCase(),
        route: form.route.toLowerCase(),
        shift: form.shift,
        deliveryCount: Number(form.deliveryCount),
        returnCount: Number(form.returnCount),
        totalCount,
        createdAt: serverTimestamp(),
      })

      setMessage('✅ 실적이 성공적으로 저장되었습니다!')
      setForm({ date: '', coupangId: '', route: '', shift: '', deliveryCount: '', returnCount: '' })
      setTotalCount(0)
    } catch (err) {
      console.error(err)
      setMessage('❌ 저장에 실패했습니다.')
    }
  }

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-blue-600">📥 기사 실적 입력 (tab0)</h1>

        <label className="font-semibold">배송일자 *</label>
        <input name="date" type="date" value={form.date} onChange={handleChange} className="border p-2 mb-1 w-full" />
        {errors.date && <p className="text-red-500 text-sm mb-2">필수 입력입니다.</p>}

        <label className="font-semibold">쿠팡 ID *</label>
        <input name="coupangId" placeholder="예: cp1234" type="text" value={form.coupangId} onChange={handleChange} className="border p-2 mb-1 w-full" />
        {errors.coupangId && <p className="text-red-500 text-sm mb-2">필수 입력입니다.</p>}

        <label className="font-semibold">노선명 *</label>
        <input name="route" placeholder="예: B101" type="text" value={form.route} onChange={handleChange} className="border p-2 mb-1 w-full" />
        {errors.route && <p className="text-red-500 text-sm mb-2">필수 입력입니다.</p>}

        <label className="font-semibold">주/야 *</label>
        <select name="shift" value={form.shift} onChange={handleChange} className="border p-2 mb-1 w-full">
          <option value="">-- 선택하세요 --</option>
          <option value="주간">주간</option>
          <option value="야간">야간</option>
        </select>
        {errors.shift && <p className="text-red-500 text-sm mb-2">필수 입력입니다.</p>}

        <label className="font-semibold">배송 건수</label>
        <input name="deliveryCount" type="number" min="0" value={form.deliveryCount} onChange={handleChange} className="border p-2 mb-3 w-full" />

        <label className="font-semibold">반품 건수</label>
        <input name="returnCount" type="number" min="0" value={form.returnCount} onChange={handleChange} className="border p-2 mb-4 w-full" />

        <div className="text-sm mb-4 text-right text-gray-600">총 건수: <b>{totalCount}</b></div>

        <button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
        >
          실적 저장
        </button>

        {message && <p className="mt-4 text-center text-sm whitespace-pre-wrap">{message}</p>}
      </main>
    </div>
  )
}
