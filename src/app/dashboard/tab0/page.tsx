// tab0/page.tsx (Figma 이미지 1:1 기반 스타일 반영)
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
import { ko } from 'date-fns/locale'
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
      <main className="max-w-md mx-auto py-10 px-4 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-normal text-black text-center font-sans">일일 운행 등록</h1>

        {/* 배송일 선택 */}
        <div className="w-[307px]">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full h-[48px] bg-white rounded-lg shadow-[0_0_14px_rgba(0,0,0,0.13)] flex items-center justify-between px-4 text-left text-sm font-normal">
                {form.date || '배송일 선택'}
                <CalendarIcon className="w-4 h-4 text-gray-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[307px] h-[332px] p-5 flex justify-center items-center gap-5 rounded-[11px] bg-white shadow-[0_0_14px_rgba(0,0,0,0.07)]">
              <Calendar
                mode="single"
                locale={ko}
                selected={form.date ? new Date(form.date + 'T00:00:00') : undefined}
                onSelect={(d) => {
                  if (d) {
                    const offset = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    setForm({ ...form, date: offset.toISOString().slice(0, 10) })
                    setCalendarOpen(false)
                  }
                }}
                className="rounded-md"
                modifiersClassNames={{ selected: 'bg-[#0088FF] text-white' }}
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}
        </div>

        {/* 입력 필드들 */}
        <div className="flex flex-col w-[307px] gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">쿠팡배송 어플에서 사용한 ID</label>
            <Input
              name="coupangId"
              placeholder="예: cp1234"
              value={form.coupangId}
              onChange={handleChange}
              className={`h-[48px] px-3 text-sm ${errors.coupangId ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.coupangId && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">노선명</label>
            <Input
              name="route"
              placeholder="예: A301"
              value={form.route}
              onChange={handleChange}
              className={`h-[48px] px-3 text-sm ${errors.route ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.route && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">배송건수</label>
            <Input
              name="deliveryCount"
              type="number"
              placeholder="예: 150"
              value={form.deliveryCount}
              onChange={handleChange}
              className="h-[48px] px-3 text-sm border-gray-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">반품건수</label>
            <Input
              name="returnCount"
              type="number"
              placeholder="예: 5"
              value={form.returnCount}
              onChange={handleChange}
              className="h-[48px] px-3 text-sm border-gray-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">주야간 선택</label>
            <ToggleGroup
              type="single"
              value={form.shift}
              onValueChange={(value) => setForm({ ...form, shift: value || '' })}
              className="w-full h-[48px] flex px-[3px] py-[3px] border border-gray-300 rounded-lg bg-white"
            >
              <ToggleGroupItem
                value="주간"
                className={`flex items-center justify-center w-1/2 text-sm font-medium rounded-[12px] transition-all ${
                  form.shift === '주간'
                    ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
                    : 'text-gray-700'
                }`}
              >
                주간
              </ToggleGroupItem>

              <ToggleGroupItem
                value="야간"
                className={`flex items-center justify-center w-1/2 text-sm font-medium rounded-[12px] transition-all ${
                  form.shift === '야간'
                    ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
                    : 'text-gray-700'
                }`}
              >
                야간
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* 저장 버튼 */}
        <Button
          onClick={handleSubmit}
         className="w-[85px] h-[41px] px-4 py-2 rounded-md border border-[#0088FF] bg-[#0088FF] text-white text-sm font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.15)] hover:brightness-110 transition-all"

        >
          저장하기
        </Button>

        {message && <p className="text-sm text-center text-gray-700 font-medium whitespace-pre-wrap">{message}</p>}
      </main>
    </div>
  )
}
