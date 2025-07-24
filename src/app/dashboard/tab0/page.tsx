// tab0 리디자인 버전 (사진 기준)
'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Tab0Redesign() {
  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    route: '',
    deliveryCount: '',
    returnCount: '',
    shift: ''
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [errors, setErrors] = useState({
    date: false,
    coupangId: false,
    route: false,
    shift: false
  })
  const [message, setMessage] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = () => {
    const newErrors = {
      date: !form.date,
      coupangId: !form.coupangId,
      route: !form.route,
      shift: !form.shift
    }
    setErrors(newErrors)

    if (Object.values(newErrors).some(Boolean)) return

    // 저장 로직 (예시용 메시지)
    setMessage('✅ 저장되었습니다')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-10 gap-6 bg-white">
      <h1 className="text-2xl font-bold text-gray-800">일일 운행 등록</h1>

      {/* 배송일 선택 */}
      <div className="w-[307px]">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="w-[307px] h-[48px] bg-white rounded-lg shadow-[0_0_14px_rgba(0,0,0,0.13)] flex items-center justify-between px-4 text-left text-sm font-medium">
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

      {/* 입력 필드 */}
      <div className="flex flex-col gap-4 w-[307px]">
        <div className="flex flex-col gap-1">
          <Input
            name="coupangId"
            placeholder="쿠팡배송 어플에서 사용한 ID"
            value={form.coupangId}
            onChange={handleChange}
            className={`h-[48px] px-3 text-sm border ${errors.coupangId ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.coupangId && <p className="text-xs text-red-500">필수 입력입니다.</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Input
            name="route"
            placeholder="노선명"
            value={form.route}
            onChange={handleChange}
            className={`h-[48px] px-3 text-sm border ${errors.route ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.route && <p className="text-xs text-red-500">필수 입력입니다.</p>}
        </div>

        <Input
          name="deliveryCount"
          type="number"
          placeholder="배송건수"
          value={form.deliveryCount}
          onChange={handleChange}
          className="h-[48px] px-3 text-sm border border-gray-300"
        />

        <Input
          name="returnCount"
          type="number"
          placeholder="반품건수"
          value={form.returnCount}
          onChange={handleChange}
          className="h-[48px] px-3 text-sm border border-gray-300"
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
          className={`flex items-center flex-1 justify-center px-[10px] py-[3px] text-sm font-medium rounded-[20px] transition-all
            ${form.shift === '주간'
              ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
              : 'text-gray-700 bg-transparent'}`}
        >
          주간
        </ToggleGroupItem>
        <ToggleGroupItem
          value="야간"
          className={`flex items-center flex-1 justify-center px-[10px] py-[3px] text-sm font-medium rounded-[20px] transition-all
            ${form.shift === '야간'
              ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
              : 'text-gray-700 bg-transparent'}`}
        >
          야간
        </ToggleGroupItem>
      </ToggleGroup>
      {errors.shift && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}

      {/* 저장 버튼 */}
      <Button
        onClick={handleSubmit}
        className="w-[85px] h-[41px] px-4 py-2 rounded-md border border-[#E0E0E0] bg-black text-white text-sm font-semibold shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
      >
        저장하기
      </Button>

      {message && (
        <p className="text-sm text-gray-700 font-medium text-center whitespace-pre-wrap">{message}</p>
      )}
    </main>
  )
}
