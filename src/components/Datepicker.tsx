'use client'

import React from 'react'

interface DatepickerProps {
  placeholder?: string
}

export default function Datepicker({ placeholder = '날짜지정' }: DatepickerProps) {
  return (
    <input
      type="date"
      placeholder={placeholder}
      className="
        w-[240px] h-[48px] px-4 py-2
        bg-white
        border border-neutral-100
        rounded-md shadow-500
        text-neutral-100
        font-tablet-caption text-[var(--tablet-caption-font-size)]
        focus:outline-none focus:ring-2 focus:ring-primary-500
      "
    />
  )
}
