'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import CustomCalendar from './CustomCalendar'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

interface Props {
  onChange?: (start: string, end: string) => void
}

export default function DateRangeBox({ onChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const handleChange = (start: string, end: string) => {
    setStart(start)
    setEnd(end)
    onChange?.(start, end)
    setShowCalendar(false)
  }

  return (
    <div className="relative w-[240px]">
      {/* 날짜 선택 버튼 */}
      <button
        onClick={() => setShowCalendar(!showCalendar)}
        className="
          w-full h-[44px] px-4
          bg-white
          border border-neutral-500
          text-black
          font-button-medium text-[var(--button-medium-font-size)]
          shadow-500
          rounded-md text-left
          hover:opacity-90 transition
          flex items-center gap-2
        "
      >
        <CalendarDaysIcon className="w-5 h-5 text-black" />
        {start && end
          ? `${format(new Date(start), 'yyyy.MM.dd')} ~ ${format(new Date(end), 'yyyy.MM.dd')}`
          : '날짜 선택'}
      </button>

      {/* 달력 */}
      {showCalendar && (
        <div className="absolute z-10 mt-2">
          <CustomCalendar onChange={handleChange} />
        </div>
      )}
    </div>
  )
}
