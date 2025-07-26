'use client'

import { useState } from 'react'
import { DateRange, Range, RangeKeyDict } from 'react-date-range'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'


interface Props {
  onChange?: (start: string, end: string) => void
}

export default function DateRangeBox({ onChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [range, setRange] = useState<Range[]>([{
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  }])

  const handleSelect = (ranges: RangeKeyDict) => {
    const selected = ranges.selection
    if (selected && selected.startDate && selected.endDate) {
      setRange([selected])
      const start = format(selected.startDate, 'yyyy-MM-dd')
      const end = format(selected.endDate, 'yyyy-MM-dd')
      onChange?.(start, end)
    }
  }

  return (
    <div className="relative w-[240px]">
      {/* 날짜 선택 버튼 */}
      <button
  onClick={() => setShowCalendar(!showCalendar)}
  className="
    w-full h-[44px] px-4
    bg-white
    border border-neutral-100
    text-neutral-100
    font-button-medium text-[var(--button-medium-font-size)]
    shadow-500
    rounded-md text-left
    hover:opacity-90 transition
    flex items-center gap-2
  "
>
  <CalendarDaysIcon className="w-5 h-5 text-neutral-100" />
  {`${format(range[0].startDate!, 'yyyy.MM.dd')} ~ ${format(range[0].endDate!, 'yyyy.MM.dd')}`}
</button>

      {/* 달력 */}
      {showCalendar && (
        <div className="absolute z-10 mt-2 shadow-500 bg-white rounded-md p-2">
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
  );
}
