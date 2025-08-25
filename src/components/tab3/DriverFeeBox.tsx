'use client'

interface Deductions {
  empDeduct?: number
  indDeduct?: number
  rentalDeduct?: number
  damageDeduct?: number
  etcDeduct?: number
}

interface Props {
  deductions: Deductions
  onChange: (field: keyof Deductions, value: string) => void
  disabled?: boolean
}

export default function DriverFeeBox({ deductions, onChange, disabled = false }: Props) {
  const fields: Array<{ key: keyof Deductions; placeholder: string; aria: string }> = [
    { key: 'empDeduct',    placeholder: '기사부담 고용보험비 입력',   aria: '기사부담 고용보험비' },
    { key: 'indDeduct',    placeholder: '기사부담 산재보험비 입력',   aria: '기사부담 산재보험비' },
    { key: 'rentalDeduct', placeholder: '운송지원비 입력',           aria: '운송지원비' },
    { key: 'damageDeduct', placeholder: '파손/분실비 입력',          aria: '파손 또는 분실비' },
    { key: 'etcDeduct',    placeholder: '기타 공제 입력',            aria: '기타 공제' },
  ]

  return (
    // 외부 폭은 부모에서 w-[360px]로 통제
    <div className="w-full rounded-2xl p-[2px] bg-gradient-to-b from-[#FF6B6B] to-[#FF3538] shadow-md">
      <div className="rounded-2xl bg-transparent text-white p-5">
        <h3 className="text-center text-[16px] font-semibold mb-4">기사부담 비용 입력</h3>

        <div className="flex flex-col space-y-3">
          {fields.map(({ key, placeholder, aria }) => (
            <input
              key={key}
              aria-label={aria}
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder={placeholder}
              value={deductions[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
              disabled={disabled}
              className={`w-full h-11 px-4 rounded-lg border text-[14px] text-right
                          placeholder:text-neutral-400
                          ${disabled ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-white text-black'}
                          border-neutral-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/50`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
