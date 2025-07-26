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
      className="w-[240px] h-[48px] px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}
