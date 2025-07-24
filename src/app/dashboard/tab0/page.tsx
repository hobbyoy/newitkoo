'use client'

import { useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

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
    <div className="bg-gray-50 min-h-screen">
      <TabNavigation />
      <main className="max-w-xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-blue-700">📥 기사 실적 입력 (Tab0)</h1>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>배송일자 *</Label>
              <Input type="date" name="date" value={form.date} onChange={handleChange} />
              {errors.date && <p className="text-red-500 text-sm">필수 입력입니다.</p>}
            </div>

            <div>
              <Label>쿠팡 ID *</Label>
              <Input name="coupangId" placeholder="예: cp1234" value={form.coupangId} onChange={handleChange} />
              {errors.coupangId && <p className="text-red-500 text-sm">필수 입력입니다.</p>}
            </div>

            <div>
              <Label>노선명 *</Label>
              <Input name="route" placeholder="예: B101" value={form.route} onChange={handleChange} />
              {errors.route && <p className="text-red-500 text-sm">필수 입력입니다.</p>}
            </div>

            <div>
              <Label>주/야 *</Label>
              <select
                name="shift"
                value={form.shift}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value="">-- 선택하세요 --</option>
                <option value="주간">주간</option>
                <option value="야간">야간</option>
              </select>
              {errors.shift && <p className="text-red-500 text-sm">필수 입력입니다.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>배송 건수</Label>
                <Input
                  name="deliveryCount"
                  type="number"
                  min="0"
                  value={form.deliveryCount}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label>반품 건수</Label>
                <Input
                  name="returnCount"
                  type="number"
                  min="0"
                  value={form.returnCount}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="text-sm text-right text-gray-600">
              총 건수: <b>{totalCount}</b> 건
            </div>
          </CardContent>
        </Card>

        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSubmit}>
          💾 실적 저장
        </Button>

        {message && <p className="text-center text-sm whitespace-pre-wrap mt-2">{message}</p>}
      </main>
    </div>
  )
}
