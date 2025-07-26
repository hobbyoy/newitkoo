// components/tab3/DriverFeeBox.tsx
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
    <div className="bg-gradient-to-b from-[#FF5858] to-[#FF0000] rounded-[20px] p-5 text-white">
      <h3 className="text-[16px] font-semibold text-center mb-4">기사부담 비용 입력</h3>
      <div className="grid gap-3">
        <div className="flex justify-between items-center">
          <span className="text-sm w-24">고용보험</span>
          <input
            type="number"
            placeholder="0"
            value={deductions.empDeduct ?? ''}
            onChange={(e) => onChange('empDeduct', e.target.value)}
            className="bg-white text-black px-3 py-2 rounded w-40 text-right"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm w-24">산재보험</span>
          <input
            type="number"
            placeholder="0"
            value={deductions.indDeduct ?? ''}
            onChange={(e) => onChange('indDeduct', e.target.value)}
            className="bg-white text-black px-3 py-2 rounded w-40 text-right"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm w-24">운송지원비</span>
          <input
            type="number"
            placeholder="0"
            value={deductions.rentalDeduct ?? ''}
            onChange={(e) => onChange('rentalDeduct', e.target.value)}
            className="bg-white text-black px-3 py-2 rounded w-40 text-right"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm w-24">파손/분실</span>
          <input
            type="number"
            placeholder="0"
            value={deductions.damageDeduct ?? ''}
            onChange={(e) => onChange('damageDeduct', e.target.value)}
            className="bg-white text-black px-3 py-2 rounded w-40 text-right"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm w-24">기타 공제</span>
          <input
            type="number"
            placeholder="0"
            value={deductions.etcDeduct ?? ''}
            onChange={(e) => onChange('etcDeduct', e.target.value)}
            className="bg-white text-black px-3 py-2 rounded w-40 text-right"
          />
        </div>
      </div>
    </div>
  )
}
