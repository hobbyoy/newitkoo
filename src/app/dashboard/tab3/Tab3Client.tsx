// Tab3Client.tsx - Figma 기준 전체 UI 리디자인 (간격, 필드, 폰트 정확히 반영)

'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'
import notoVfs from '@/lib/fonts/noto-vfs'
import DateRangeBox from '@/components/tab3/DateRangeBox'
import Datepicker from '@/components/tab3/Datepicker'
import DriverSelectBox from '@/components/tab3/DriverSelectBox'
import DriverFeeBox from '@/components/tab3/DriverFeeBox'

interface Driver {
  uid: string
  email: string
  name: string
}

interface RecordData {
  uid: string
  email: string
  name: string
  route: string
  coupangId: string
  deliveryCount: number
  returnCount: number
}

interface RouteUnit {
  driverUnitPrice: number
  coupangUnitPrice: number
}

interface Summary {
  uid: string
  email: string
  name: string
  ids: Set<string>
  routes: Set<string>
  totalDelivery: number
  totalReturn: number
  totalCount: number
  driverIncome: number
  totalFee: number
}

interface Deductions {
  empDeduct: number
  indDeduct: number
  rentalDeduct: number
  damageDeduct: number
  etcDeduct: number
  freshback: number
}

interface PdfMakeInstance {
  createPdf: (docDef: object) => {
    download: (filename?: string) => void
  }
  vfs?: Record<string, string>
  fonts?: unknown
}

const Tab3Client = () => {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [driverList, setDriverList] = useState<Driver[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [deductions, setDeductions] = useState<Record<string, Partial<Deductions>>>({})
  const pdfMakeRef = useRef<PdfMakeInstance | null>(null)

  const handleDeductionChange = (
    field: keyof Deductions,
    value: string
  ): void => {
    if (!selectedUid) return
    setDeductions(prev => ({
      ...prev,
      [selectedUid]: {
        ...prev[selectedUid],
        [field]: Number(value) || 0
      }
    }))
  }

  const selectedDriver = useMemo(() => summary.find(d => d.uid === selectedUid), [summary, selectedUid])

  useEffect(() => {
    const load = async () => {
      const m = await import('pdfmake/build/pdfmake')
      const pdfMake = m.default || m
      pdfMake.vfs = notoVfs
      pdfMake.fonts = {
        NotoSans: {
          normal: 'NotoSansKR-Regular.ttf',
          bold: 'NotoSansKR-Regular.ttf',
          italics: 'NotoSansKR-Regular.ttf',
          bolditalics: 'NotoSansKR-Regular.ttf'
        }
      }
      pdfMakeRef.current = pdfMake
    }
    load()
  }, [])

  useEffect(() => {
    const loadDrivers = async () => {
      const snap = await getDocs(collection(db, 'Users'))
      const list = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<Driver, 'uid'>) }))
      setDriverList(list)
    }
    loadDrivers()
  }, [])

  useEffect(() => {
    if (!startDate || !endDate) return
    const loadSummary = async () => {
      const q = query(collection(db, 'DailyRecords'), where('deliveryDate', '>=', startDate), where('deliveryDate', '<=', endDate))
      const snap = await getDocs(q)
      const raw = snap.docs.map(doc => doc.data()) as RecordData[]
      const map: Record<string, Summary> = {}
      for (const item of raw) {
        const key = item.uid
        if (!map[key]) {
          map[key] = {
            uid: item.uid,
            email: item.email,
            name: item.name,
            ids: new Set(),
            routes: new Set(),
            totalDelivery: 0,
            totalReturn: 0,
            totalCount: 0,
            driverIncome: 0,
            totalFee: 0
          }
        }
        const delivery = item.deliveryCount
        const returns = item.returnCount
        const total = delivery + returns
        const routeKey = `${item.route}_${item.coupangId}`.toUpperCase()
        const routeSnap = await getDoc(doc(db, 'Routes', routeKey))
        const unit = routeSnap.exists() ? (routeSnap.data() as RouteUnit) : { driverUnitPrice: 0, coupangUnitPrice: 0 }
        map[key].ids.add(item.coupangId)
        map[key].routes.add(item.route)
        map[key].totalDelivery += delivery
        map[key].totalReturn += returns
        map[key].totalCount += total
        map[key].driverIncome += total * unit.driverUnitPrice
        map[key].totalFee += total * (unit.coupangUnitPrice - unit.driverUnitPrice)
      }
      setSummary(Object.values(map))
    }
    loadSummary()
  }, [startDate, endDate])

  return (
    <div className="bg-[#ffffff] min-h-screen">
      <TabNavigation />
      <main className="max-w-[1024px] mx-auto py-8 px-4">
        <h1 className="text-[12px] font-semibold text-black mb-4">기사별 실지급 정산</h1>

        {/* 날짜 & 기사 선택 */}
  <div className="flex flex-row items-center justify-center gap-4 mb-6">
  <div className="w-[350px]">
    <DateRangeBox
      onChange={(start, end) => {
        setStartDate(start)
        setEndDate(end)
      }}
    />
  </div>

  <div className="w-[350px]">
    <DriverSelectBox
      value={selectedUid}
      onChange={(uid) => setSelectedUid(uid)}
      options={driverList}
      disabled={!summary.length}
    />
  </div>
  </div>

  {selectedDriver && (
    <>
  <h2 className="text-[36px] font-bold text-black mb-1">{selectedDriver.name}</h2>
                <p className="text-[16px] text-black">{selectedDriver.email}</p>
                <p className="text-[12px] text-black mt-1 leading-relaxed">
                  노선: {Array.from(selectedDriver.routes).join(', ')}<br />
                  쿠팡ID: {Array.from(selectedDriver.ids).join(', ')}<br />
                  배송: {selectedDriver.totalDelivery}건 / 반품: {selectedDriver.totalReturn}건 / 총 {selectedDriver.totalCount}건<br />
                  기사수익: {selectedDriver.driverIncome.toLocaleString()}원
                </p>

</>
  )}
  

 {/* 정산 카드: 공제입력 + 프레시백 + 합계 + 버튼을 한 카드 안에 묶기 */}
{selectedDriver ? (
  <div className="mx-auto w-full max-w-[720px] bg-white rounded-2xl shadow-md p-6 space-y-6">
    {/* 공제 입력 */}
    <DriverFeeBox
      deductions={deductions[selectedDriver.uid] || {}}
      onChange={(field, value) => handleDeductionChange(field, value)}
    />

    {/* 프레시백 */}
    {(() => {
      const d = deductions[selectedDriver.uid] || {}
      return (
        <div className="rounded-2xl p-5 text-white bg-gradient-to-b from-[#58AFFF] to-[#007BFF]">
          <h3 className="text-[16px] font-semibold text-center mb-4">기사 추가 수익</h3>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm">프레시백 수익</label>
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="0"
              value={(d.freshback ?? '').toString()}
              onChange={(e) => handleDeductionChange('freshback', e.target.value)}
              className="bg-white text-black px-3 py-2 rounded w-40 text-right"
            />
          </div>
        </div>
      )
    })()}

    {/* 최종 실지급액 */}
    {(() => {
      const d = deductions[selectedDriver.uid] || {}
      const totalDeduct =
        (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
      const freshback = d.freshback || 0
      const finalPay = selectedDriver.driverIncome - totalDeduct + freshback
      return (
        <div className="border-t border-black/10 pt-6 flex items-center justify-between">
          <span className="text-[16px] font-medium">최종 기사 실지급액</span>
          <span className="text-[24px] font-bold">{finalPay.toLocaleString()}원</span>
        </div>
      )
    })()}

    {/* 버튼 */}
    <div className="flex justify-center gap-3">
      <button
        onClick={() =>
          pdfMakeRef.current?.createPdf({
            content: [{ text: `${selectedDriver.name} 실지급 정산`, style: 'h' }],
            styles: { h: { fontSize: 16, bold: true } },
            defaultStyle: { font: 'NotoSans' },
          }).download(`${selectedDriver.name}_${startDate}_${endDate}.pdf`)
        }
        className="bg-black text-white px-5 py-2 rounded hover:opacity-90 text-sm"
      >
        📄 PDF 저장
      </button>

      <button
        onClick={async () => {
          const d = deductions[selectedDriver.uid] || {}
          const totalDeduct =
            (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
          const freshback = d.freshback || 0
          const finalPay = selectedDriver.driverIncome - totalDeduct + freshback

          const docRef = doc(db, 'FinalPayouts', `${selectedDriver.uid}_${startDate}_${endDate}`)
          const exists = await getDoc(docRef)
          if (exists.exists()) return alert('⚠️ 이미 저장된 정산 데이터입니다.')

          await setDoc(docRef, {
            uid: selectedDriver.uid,
            email: selectedDriver.email,
            name: selectedDriver.name,
            startDate, endDate,
            totalDelivery: selectedDriver.totalDelivery,
            totalReturn: selectedDriver.totalReturn,
            totalCount: selectedDriver.totalCount,
            driverIncome: selectedDriver.driverIncome,
            totalFee: selectedDriver.totalFee,
            itkooFee: selectedDriver.totalFee,
            ids: Array.from(selectedDriver.ids),
            routes: Array.from(selectedDriver.routes),
            totalDeduction: totalDeduct,
            freshback,
            finalPay,
            createdAt: new Date() // 나중에 serverTimestamp()로 교체 추천
          })
          alert('✅ 저장 완료')
        }}
        className="bg-black text-white px-5 py-2 rounded hover:opacity-90 text-sm"
      >
        💾 저장하기
      </button>
    </div>
  </div>
) : (
  <div className="mx-auto w-full max-w-[720px] bg-white rounded-2xl shadow p-10 text-center text-gray-500">
    기간과 기사를 선택하면 정산 카드가 표시됩니다.
  </div>
)}
      </main>
    </div>
  )
}
export default Tab3Client