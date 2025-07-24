// tab0/page.tsx (Figma 스타일 1:1 완성 코드)
'use client'

import { useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

export default function Tab0() {
  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    route: '',
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-md mx-auto py-10 px-6 flex flex-col items-center space-y-6">
        <h1 className="text-2xl font-bold text-center">일일 운행 등록</h1>

        {/* 날짜 선택 */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between border rounded-lg text-base font-normal"
            >
              {form.date ? form.date : '배송일 선택'}
              <CalendarIcon className="ml-2 h-4 w-4 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 mt-2 rounded-xl shadow-xl">
            <Calendar
              mode="single"
              selected={form.date ? new Date(form.date) : undefined}
              onSelect={(d) => {
                if (d) {
                  setForm({ ...form, date: d.toISOString().slice(0, 10) })
                  setCalendarOpen(false)
                }
              }}
              className="rounded-xl"
            />
          </PopoverContent>
        </Popover>
        {errors.date && <p className="text-red-500 text-xs">필수 입력입니다.</p>}

        {/* 쿠팡 ID */}
        <Input
          name="coupangId"
          placeholder="쿠팡배송 어플에서 사용한 ID"
          value={form.coupangId}
          onChange={handleChange}
        />
        {errors.coupangId && <p className="text-red-500 text-xs">필수 입력입니다.</p>}

        {/* 노선명 */}
        <Input
          name="route"
          placeholder="노선명 (예: a301)"
          value={form.route}
          onChange={handleChange}
        />
        {errors.route && <p className="text-red-500 text-xs">필수 입력입니다.</p>}

        {/* 배송/반품 건수 */}
        <div className="flex gap-4 w-full">
          <Input
            name="deliveryCount"
            type="number"
            placeholder="배송건수"
            value={form.deliveryCount}
            onChange={handleChange}
          />
          <Input
            name="returnCount"
            type="number"
            placeholder="반품건수"
            value={form.returnCount}
            onChange={handleChange}
          />
        </div>

        {/* 주야 선택 */}
        <ToggleGroup
          type="single"
          className="w-full border rounded-full justify-between"
          value={form.shift}
          onValueChange={(value) => setForm({ ...form, shift: value || '' })}
        >
          <ToggleGroupItem
            value="주간"
            className={`w-1/2 rounded-full text-base font-medium py-2 ${form.shift === '주간' ? 'bg-blue-600 text-white' : ''}`}
          >
            주간
          </ToggleGroupItem>
          <ToggleGroupItem
            value="야간"
            className={`w-1/2 rounded-full text-base font-medium py-2 ${form.shift === '야간' ? 'bg-blue-600 text-white' : ''}`}
          >
            야간
          </ToggleGroupItem>
        </ToggleGroup>
        {errors.shift && <p className="text-red-500 text-xs">필수 입력입니다.</p>}

        {/* 저장 버튼 */}
        <Button
          onClick={handleSubmit}
          className="bg-black hover:bg-neutral-800 text-white text-base font-semibold py-2.5 px-8 rounded-xl"
        >
          저장하기
        </Button>

        {message && <p className="text-sm text-center text-gray-700 font-medium whitespace-pre-wrap">{message}</p>}
      </main>
    </div>
  )
}