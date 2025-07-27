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
<div className="absolute top-[200px] left-[650px] w-[350px] h-[275px] rounded-[25px] border-2 border-white bg-[linear-gradient(180deg,_rgba(255,255,255,0.2)_0%,_rgba(255,255,255,0)_100%),_#FF3538] backdrop-blur-[2px] text-white p-4 shadow-lg z-10">      <h3 className="text-center text-[24px] font-semibold text-black">기사부담 비용 입력</h3>
 <div className="flex flex-col gap-2 text-sm">
        {[
          ['고용보험', 'empDeduct'],
          ['산재보험', 'indDeduct'],
          ['운송지원비', 'rentalDeduct'],
          ['파손/분실', 'damageDeduct'],
          ['기타 공제', 'etcDeduct']
        ].map(([label, key]) => (
          <div key={key} className="flex justify-between items-center">
            <span>{label}</span>
            <input
              type="number"
              placeholder="0"
              value={deductions[key as keyof Deductions] ?? ''}
              onChange={(e) => onChange(key as keyof Deductions, e.target.value)}
              className="w-[240 px] px-2 py-1 rounded text-black text-right border border-white bg-white"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
