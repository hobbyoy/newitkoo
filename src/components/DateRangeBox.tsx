'use client'

import { useState } from 'react'
import { DateRange } from 'react-date-range'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

interface Props {
  onChange?: (start: string, end: string) => void
}

export default function DateRangeBox({ onChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [range, setRange] = useState([{
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection' as const,
  }])

  const handleSelect = (ranges: any) => {
    const selected = ranges.selection
    setRange([selected])
    const start = format(selected.startDate, 'yyyy-MM-dd')
    const end = format(selected.endDate, 'yyyy-MM-dd')
    onChange?.(start, end)
  }

  return (
    <div className="relative w-[240px]">
      {/* 날짜 범위 버튼 */}
      <button
        onClick={() => setShowCalendar(!showCalendar)}
        className="w-full h-[44px] px-4 border border-gray-300 rounded-md text-left text-sm bg-white"
      >
        {`${format(range[0].startDate, 'yyyy.MM.dd')} ~ ${format(range[0].endDate, 'yyyy.MM.dd')}`}
      </button>

      {/* 달력 */}
      {showCalendar && (
        <div className="absolute z-10 mt-2 shadow-lg">
          <DateRange
            editableDateInputs
            locale={ko}
            onChange={handleSelect}
            moveRangeOnFirstSelection={false}
            ranges={range}
            rangeColors={['#0088FF']}
            maxDate={new Date()}
          />
        </div>
      )}
    </div>
  )
}
