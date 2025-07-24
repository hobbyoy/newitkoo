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
        <h1 className="text-2xl font-normal text-black text-center font-sans">일일 운행 등록</h1>

      
        {/* 배송일 선택 */}
<div className="w-[307px]">
  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
    <PopoverTrigger asChild>
      <button className="w-[307px] h-[48px] bg-white rounded-lg shadow-[0_0_14px_rgba(0,0,0,0.13)] flex items-center justify-between px-4 text-left text-sm font-normal">
        {form.date || '배송일 선택'}
        <CalendarIcon className="w-4 h-4 text-gray-500" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-[307px] h-[332px] p-5 flex flex-col items-end gap-5 rounded-[11px] bg-white shadow-[0_0_14px_rgba(0,0,0,0.07)]">
      <Calendar
        mode="single"
        selected={form.date ? new Date(form.date) : undefined}
        onSelect={(d) => {
          if (d) {
            setForm({ ...form, date: d.toISOString().slice(0, 10) })
            setCalendarOpen(false)
          }
        }}
        className="rounded-md"
      />
    </PopoverContent>
  </Popover>
  {errors.date && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}
</div>


     {/* 입력 필드들 */}
    <div className="flex flex-col w-[307px] h-[77px] items-start gap-2">
    <label className="text-sm font-medium text-gray-700">쿠팡배송 어플에서 사용한 ID</label>
    <Input
    name="coupangId"
    placeholder="예: cp1234"
    value={form.coupangId}
    onChange={handleChange}
    className={errors.coupangId ? 'border-red-500' : ''}
    />
   {errors.coupangId && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
</div>


  <div className="flex flex-col w-[307px] h-[77px] items-start gap-2">
  <label className="text-sm font-medium text-gray-700">노선명</label>
  <Input
    name="route"
    placeholder="예: A301"
    value={form.route}
    onChange={handleChange}
    className={errors.route ? 'border-red-500' : ''}
  />
  {errors.route && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
  </div>


  <div className="flex flex-col w-[307px] h-[77px] items-start gap-2">
  <label className="text-sm font-medium text-gray-700">배송건수</label>
  <Input
    name="deliveryCount"
    type="number"
    placeholder="예: 150"
    value={form.deliveryCount}
    onChange={handleChange}
  />
</div>

<div className="flex flex-col w-[307px] h-[77px] items-start gap-2">
  <label className="text-sm font-medium text-gray-700">반품건수</label>
  <Input
    name="returnCount"
    type="number"
    placeholder="예: 5"
    value={form.returnCount}
    onChange={handleChange}
  />
</div>


  {/* 주야간 선택 */}
<ToggleGroup
  type="single"
  value={form.shift}
  onValueChange={(value) => setForm({ ...form, shift: value || '' })}
  className="flex justify-center items-center w-[307px] h-[41px] px-2 py-1 rounded-full border border-[#E0E0E0] bg-white shadow-inner"
>
  <ToggleGroupItem
    value="주간"
    className={`flex items-center self-stretch flex-1 px-[10px] py-[3px] text-sm font-medium rounded-[20px] transition-all ${
      form.shift === '주간'
        ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
        : 'text-gray-700 bg-transparent'
    }`}
  >
    주간
  </ToggleGroupItem>

  <ToggleGroupItem
    value="야간"
    className={`flex items-center self-stretch flex-1 px-[10px] py-[3px] text-sm font-medium rounded-[20px] transition-all ${
      form.shift === '야간'
        ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
        : 'text-gray-700 bg-transparent'
    }`}
  >
    야간
  </ToggleGroupItem>
</ToggleGroup>


        {errors.shift && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}

        {/* 저장 버튼 */}
      <Button
      onClick={handleSubmit}
      className="flex w-[85px] h-[41px] px-2 py-2 justify-center items-center gap-1 rounded-md border border-[#E0E0E0] bg-black text-white text-sm font-semibold shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
        >
      저장하기
      </Button>


        {message && <p className="text-sm text-center text-gray-700 font-medium whitespace-pre-wrap">{message}</p>}
      </main>
    </div>
  )
}