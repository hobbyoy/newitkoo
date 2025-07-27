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
}

export default function DriverFeeBox({ deductions, onChange }: Props) {
  return (
  <div className="relative w-[350px] h-auto p-[2px] rounded-[25px] bg-gradient-to-b from-white via-white/20 to-transparent">
  <div className="rounded-[23px] bg-[#FF3538] backdrop-blur-[2px] text-white p-4">
      <h3 className="text-center text-[20px] font-semibold text-white mb-3">기사부담 비용 입력</h3>

      <div className="flex flex-col gap-3 text-sm">
        {[
          ['기사부담 고용보험비 입력', 'empDeduct'],
          ['기사부담 산재보험비 입력', 'indDeduct'],
          ['기사부담 운송지원비 입력', 'rentalDeduct'],
          ['기사부담 파손/분실비 입력', 'damageDeduct'],
          ['기사부담 기타 공제 입력', 'etcDeduct']
        ].map(([placeholder, key]) => (
          <div
            key={key}
            className="flex flex-col w-[284px] items-start gap-1 bg-white px-4 py-3 rounded-lg text-black"
          >
            <input
              type="number"
              placeholder={placeholder}
              value={deductions[key as keyof Deductions] ?? ''}
              onChange={(e) => onChange(key as keyof Deductions, e.target.value)}
              className="w-full h-9 px-3 py-1 rounded-md border border-gray-300 text-sm text-right focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}

