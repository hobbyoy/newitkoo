'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameDay, isSameMonth, isAfter, isBefore } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Props {
  onChange?: (start: string, end: string) => void
}

export default function CustomCalendar({ onChange }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date)
      setEndDate(null)
    } else if (date < startDate) {
      setStartDate(date)
    } else {
      setEndDate(date)
      const start = format(startDate, 'yyyy-MM-dd')
      const end = format(date, 'yyyy-MM-dd')
      onChange?.(start, end)
    }
  }

  const renderDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ko })
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ko })
    const days = []
    let date = start

    while (date <= end) {
      days.push(date)
      date = addDays(date, 1)
    }

    return (
      <div className="grid grid-cols-7 gap-1 mt-4 text-center text-neutral-100 text-sm">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="font-semibold text-neutral-500">{day}</div>
        ))}
        {days.map((day, i) => {
          const isStart = startDate && isSameDay(day, startDate)
          const isEnd = endDate && isSameDay(day, endDate)
          const inRange = startDate && endDate && isAfter(day, startDate) && isBefore(day, endDate)
          const isOutside = !isSameMonth(day, currentMonth)

          return (
            <div
              key={i}
              onClick={() => handleDateClick(day)}
              className={`
                h-10 flex items-center justify-center rounded-full cursor-pointer
                text-sm transition font-medium
                ${isStart || isEnd ? 'bg-[#2280EF] text-white font-bold' : ''}
                ${inRange ? 'bg-[#DFF0FD] text-[#2280EF]' : ''}
                ${isOutside ? 'text-[#BBBBBB]' : 'text-[#141414]'}
                hover:bg-primary-25 hover:text-primary-500 transition
              `}
            >
              {format(day, 'd')}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-[240px] h-auto bg-white rounded-2xl shadow-500 border border-neutral-500 p-4">
      {/* 상단 월 + 이동 버튼 */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          <ChevronLeftIcon className="w-5 h-5 text-neutral-500" />
        </button>
        <div className="text-[16px] font-tablet-subtitles-subtitle-1 text-neutral-500">
          {format(currentMonth, 'MMMM yyyy', { locale: ko })}
        </div>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRightIcon className="w-5 h-5 text-neutral-500" />
        </button>
      </div>

      {/* 날짜 셀 */}
      {renderDays()}
    </div>
  )
}
