'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface Driver {
  uid: string
  name: string
  email: string
}

interface Props {
  value: string
  onChange: (uid: string) => void
  options: Driver[]
  disabled?: boolean
}

export default function DriverSelectBox({
  value,
  onChange,
  options,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)

  const selected = options.find((d) => d.uid === value)

  return (
    <div className="flex flex-col gap-1 w-[256px] relative">
      {/* 버튼 */}
      <div
        onClick={() => !disabled && setOpen(!open)}
        className={`
          flex justify-between items-center h-[44px] px-4
          bg-white border rounded-md shadow-500 cursor-pointer
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
          border-neutral-500
        `}
      >
        <span className="font-tablet-caption text-[var(--tablet-caption-font-size)] text-black">
          {selected ? `${selected.name} (${selected.email})` : '기사 선택'}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-black" />
      </div>

      {/* 옵션 목록 */}
      {open && (
        <div
          className="absolute top-[70px] left-0 z-20 w-full bg-white border border-neutral-500 rounded-md shadow-500"
        >
          {options.map((d) => (
            <div
              key={d.uid}
              onClick={() => {
                onChange(d.uid)
                setOpen(false)
              }}
              className="px-4 py-2 hover:bg-neutral-50 text-black text-sm cursor-pointer"
            >
              {d.name} ({d.email})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
