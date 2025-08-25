// src/components/tab3/DriverFeeBox.tsx
'use client'

interface Deductions {
  empDeduct?: number
  indDeduct?: number
  rentalDeduct?: number
  damageDeduct?: number
  etcDeduct?: number
}
interface Props { deductions: Deductions; onChange: (field: keyof Deductions, value: string) => void }

export default function DriverFeeBox({ deductions, onChange }: Props) {
  const fields: Array<{ key: keyof Deductions; label: string; placeholder: string }> = [
    { key: 'empDeduct',    label: '고용보험',     placeholder: '기사부담 고용보험비 입력' },
    { key: 'indDeduct',    label: '산재보험',     placeholder: '기사부담 산재보험비 입력' },
    { key: 'rentalDeduct', label: '운송지원비',   placeholder: '운송지원비 입력' },
    { key: 'damageDeduct', label: '차감비',       placeholder: '기타 차감비 입력' },
    { key: 'etcDeduct',    label: '기타 공제',    placeholder: '기타 공제 입력' },
  ]

  return (
    <div className="relative w-full rounded-[20px] p-[2px] bg-gradient-to-b from-[#FF6B6B] to-[#FF3538]">
      <div className="rounded-[18px] bg-transparent text-white shadow-md p-5">
        <h3 className="text-center text-[16px] font-semibold mb-4">기사부담 비용 입력</h3>

        <div className="flex flex-col gap-3">
          {fields.map(({ key, label, placeholder }) => (
            <label key={key} className="w-full bg-white rounded-xl px-4 py-3 text-black shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">{label}</span>
                <input
                  aria-label={label}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  placeholder={placeholder}
                  value={deductions[key] ?? ''}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="w-40 h-11 px-3 rounded-md border border-neutral-300
                             text-[14px] text-right placeholder:text-neutral-400
                             focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
                />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
