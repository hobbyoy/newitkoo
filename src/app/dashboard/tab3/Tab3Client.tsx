// src/app/dashboard/tab3/Tab3Client.tsx
'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'
import notoVfs from '@/lib/fonts/noto-vfs'
import DateRangeBox from '@/components/tab3/DateRangeBox'
import DriverSelectBox from '@/components/tab3/DriverSelectBox'
import DriverFeeBox from '@/components/tab3/DriverFeeBox'

interface Driver { uid: string; email: string; name: string }
interface RecordData { uid: string; email: string; name: string; route: string; coupangId: string; deliveryCount: number; returnCount: number }
interface RouteUnit { driverUnitPrice: number; coupangUnitPrice: number }
interface Summary {
  uid: string; email: string; name: string; ids: Set<string>; routes: Set<string>;
  totalDelivery: number; totalReturn: number; totalCount: number; driverIncome: number; totalFee: number
}
interface Deductions { empDeduct: number; indDeduct: number; rentalDeduct: number; damageDeduct: number; etcDeduct: number; freshback: number }
interface PdfMakeInstance { createPdf: (docDef: object) => { download: (filename?: string) => void }; vfs?: Record<string, string>; fonts?: unknown }

const GRID = 'grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-[64px]'

const Tab3Client = () => {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [driverList, setDriverList] = useState<Driver[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [deductions, setDeductions] = useState<Record<string, Partial<Deductions>>>({})
  const pdfMakeRef = useRef<PdfMakeInstance | null>(null)

  const handleDeductionChange = (field: keyof Deductions, value: string) => {
    if (!selectedUid) return
    setDeductions(prev => ({ ...prev, [selectedUid]: { ...prev[selectedUid], [field]: Number(value) || 0 } }))
  }

  const selectedDriver = useMemo(() => summary.find(d => d.uid === selectedUid), [summary, selectedUid])

  useEffect(() => {
    (async () => {
      const m = await import('pdfmake/build/pdfmake')
      const pdfMake = (m.default || m) as PdfMakeInstance
      pdfMake.vfs = notoVfs
      pdfMake.fonts = {
        NotoSans: {
          normal: 'NotoSansKR-Regular.ttf',
          bold: 'NotoSansKR-Regular.ttf',
          italics: 'NotoSansKR-Regular.ttf',
          bolditalics: 'NotoSansKR-Regular.ttf',
        },
      }
      pdfMakeRef.current = pdfMake
    })()
  }, [])

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'Users'))
      const list = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<Driver, 'uid'>) }))
      setDriverList(list)
    })()
  }, [])

  useEffect(() => {
    if (!startDate || !endDate) return
    (async () => {
      const q = query(
        collection(db, 'DailyRecords'),
        where('deliveryDate', '>=', startDate),
        where('deliveryDate', '<=', endDate)
      )
      const snap = await getDocs(q)
      const raw = snap.docs.map(doc => doc.data()) as RecordData[]

      const map: Record<string, Summary> = {}
      for (const item of raw) {
        const key = item.uid
        if (!map[key]) {
          map[key] = {
            uid: item.uid, email: item.email, name: item.name,
            ids: new Set(), routes: new Set(),
            totalDelivery: 0, totalReturn: 0, totalCount: 0,
            driverIncome: 0, totalFee: 0,
          }
        }
        const delivery = item.deliveryCount
        const returns = item.returnCount
        const total = delivery + returns

        const routeKey = `${item.route}_${item.coupangId}`.toUpperCase()
        const routeSnap = await getDoc(doc(db, 'Routes', routeKey))
        const unit = routeSnap.exists()
          ? (routeSnap.data() as RouteUnit)
          : { driverUnitPrice: 0, coupangUnitPrice: 0 }

        map[key].ids.add(item.coupangId)
        map[key].routes.add(item.route)
        map[key].totalDelivery += delivery
        map[key].totalReturn += returns
        map[key].totalCount += total
        map[key].driverIncome += total * unit.driverUnitPrice
        map[key].totalFee += total * (unit.coupangUnitPrice - unit.driverUnitPrice)
      }
      setSummary(Object.values(map))
    })()
  }, [startDate, endDate])

  return (
    <div className="bg-white min-h-screen">
      <TabNavigation />
      <main className="max-w-[1024px] mx-auto py-8 px-4">
<section className="grid grid-cols-1 lg:[grid-template-columns:360px_360px] lg:justify-center gap-4 lg:gap-8 mb-10">
  <div className="w-[360px] flex flex-col gap-2">
    <h1 className="text-[12px] font-semibold text-black">기사별 실지급 정산</h1>
    <DateRangeBox onChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
  </div>
  <div className="w-[360px]">
    <DriverSelectBox value={selectedUid} onChange={setSelectedUid} options={driverList} disabled={!summary.length} />
  </div>
</section>

        {/* 같은 2열 그리드를 재사용 → 아래 컨텐츠도 위 기준선과 정확히 수직 정렬 */}
{selectedDriver ? (
  <section className="grid grid-cols-1 lg:[grid-template-columns:360px_360px] lg:justify-center gap-6 lg:gap-8">
    {/* 좌: 기사 정보 (하얀 박스 없음) */}
    <div className="w-[360px]">
      <h2 className="text-[48px] leading-tight font-bold text-black mb-2">{selectedDriver.name}</h2>
      <p className="text-[14px] text-black/80 mb-2">{selectedDriver.email}</p>
      <div className="space-y-1 text-[13px] text-black/90">
        <p>ROUTE LIST  :</p>
        <p>Coupang ID : {Array.from(selectedDriver.ids).join(', ')}</p>
        <p>배송 총 건수 : 배송 {selectedDriver.totalDelivery}건 / 반품 {selectedDriver.totalReturn}건 / 총 {selectedDriver.totalCount}건</p>
        <p className="font-semibold pt-1">기사수익 : {selectedDriver.driverIncome.toLocaleString()}원</p>
      </div>
    </div>

    {/* 우: 빨강 / 파랑 카드 — 선택박스의 x축과 정확히 일치 */}
    <div className="w-[360px] flex flex-col gap-6">
      <DriverFeeBox
        deductions={deductions[selectedDriver.uid] || {}}
        onChange={handleDeductionChange}
      />
      {(() => {
        const d = deductions[selectedDriver.uid] || {}
        return (
          <div className="rounded-2xl p-5 text-white bg-gradient-to-b from-[#58AFFF] to-[#2D91FF] shadow-md">
            <h3 className="text-[16px] font-semibold text-center mb-4">기사 추가 수익</h3>
            <input
              aria-label="기사 프레시백 수익"
              type="number" inputMode="numeric" min={0} step={1000}
              placeholder="기사 프레시백 수익"
              value={(d.freshback ?? '').toString()}
              onChange={(e) => handleDeductionChange('freshback', e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-neutral-300 shadow-sm
                         bg-white text-black text-[14px] text-right placeholder:text-neutral-400
                         focus:outline-none focus:ring-2 focus:ring-[#2D91FF]/40"
            />
          </div>
        )
      })()}
    </div>
  </section>
) : (
  <div className="mx-auto w-[720px] text-center text-gray-500">
    기간과 기사를 선택하면 정산 카드가 표시됩니다.
  </div>
)}


{/* 하단: 중앙(720px) 기준으로 레이블/금액 배치 */}
{selectedDriver && (() => {
  const d = deductions[selectedDriver.uid] || {}
  const totalDeduct = (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
  const finalPay = selectedDriver.driverIncome - totalDeduct + (d.freshback || 0)
  return (
    <div className="mx-auto w-[720px] mt-12">
      <div className="border-t-[6px] border-black my-10" />
      <div className="flex items-center justify-between">
        <span className="text-[28px] font-semibold">최종 기사 실지급액</span>
        <span className="text-[36px] font-bold">{finalPay.toLocaleString()}원</span>
      </div>
      <div className="w-[360px] mx-auto mt-6 flex justify-center gap-3">

              {/* 버튼은 가운데 */}
                <button
                  onClick={() => pdfMakeRef.current?.createPdf({
                    content: [{ text: `${selectedDriver.name} 실지급 정산`, style: 'h' }],
                    styles: { h: { fontSize: 16, bold: true } },
                    defaultStyle: { font: 'NotoSans' },
                  }).download(`${selectedDriver.name}_${startDate}_${endDate}.pdf`)}
                  className="bg-black text-white px-5 py-2 rounded hover:opacity-90 text-sm"
                >PDF 저장</button>

                <button
                  onClick={async () => {
                    const ref = doc(db, 'FinalPayouts', `${selectedDriver.uid}_${startDate}_${endDate}`)
                    const exists = await getDoc(ref); if (exists.exists()) return alert('⚠️ 이미 저장된 정산 데이터입니다.')
                    await setDoc(ref, {
                      uid: selectedDriver.uid, email: selectedDriver.email, name: selectedDriver.name,
                      startDate, endDate,
                      totalDelivery: selectedDriver.totalDelivery, totalReturn: selectedDriver.totalReturn, totalCount: selectedDriver.totalCount,
                      driverIncome: selectedDriver.driverIncome, totalFee: selectedDriver.totalFee, itkooFee: selectedDriver.totalFee,
                      ids: Array.from(selectedDriver.ids), routes: Array.from(selectedDriver.routes),
                      totalDeduction: totalDeduct, freshback: d.freshback || 0, finalPay,
                      createdAt: new Date(),
                    })
                    alert('✅ 저장 완료')
                  }}
                  className="bg-black text-white px-5 py-2 rounded hover:opacity-90 text-sm"
                >저장하기</button>
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

export default Tab3Client
