// src/app/dashboard/tab3/Tab3Client.tsx
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
import { DateRange } from 'react-date-range'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

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

type PdfMakeType = {
  createPdf: (docDefinition: object) => {
    download: (filename?: string) => void
  }
  vfs?: Record<string, string>
  fonts?: unknown
}

type RangeType = {
  startDate: Date
  endDate: Date
  key?: string
}

export default function Tab3Client() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [range, setRange] = useState<RangeType[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    }
  ])
  const [showPicker, setShowPicker] = useState(false)
  const [driverList, setDriverList] = useState<Driver[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [deductions, setDeductions] = useState<Record<string, Partial<Deductions>>>({})
  const pdfMakeRef = useRef<PdfMakeType | null>(null)

  const selectedDriver = useMemo(
    () => summary.find(d => d.uid === selectedUid),
    [summary, selectedUid]
  )

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
      try {
        const snap = await getDocs(collection(db, 'Users'))
        const list = snap.docs.map(doc => ({
          uid: doc.id,
          ...(doc.data() as Omit<Driver, 'uid'>)
        }))
        setDriverList(list)
      } catch (err) {
        console.error('❌ 기사 불러오기 오류:', err)
      }
    }
    loadDrivers()
  }, [])

  useEffect(() => {
    setStartDate(format(range[0].startDate, 'yyyy-MM-dd'))
    setEndDate(format(range[0].endDate, 'yyyy-MM-dd'))
  }, [range])

  useEffect(() => {
    if (!startDate || !endDate) return

    const loadSummary = async () => {
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
    }

    loadSummary()
  }, [startDate, endDate])

  const handleDeductionChange = (field: keyof Deductions, value: string) => {
    if (!selectedUid) return
    setDeductions(prev => ({
      ...prev,
      [selectedUid]: { ...prev[selectedUid], [field]: Number(value) || 0 }
    }))
  }

  const handleSave = async () => {
    if (!selectedDriver || !startDate || !endDate) return
    const d = deductions[selectedDriver.uid] || {}
    const totalDeduct = (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
    const freshback = d.freshback || 0
    const finalPay = selectedDriver.driverIncome - totalDeduct + freshback
    const itkooFee = selectedDriver.totalFee

    const docRef = doc(db, 'FinalPayouts', `${selectedDriver.uid}_${startDate}_${endDate}`)
    const exists = await getDoc(docRef)
    if (exists.exists()) {
      alert('⚠️ 이미 저장된 정산 데이터입니다.')
      return
    }

    try {
      await setDoc(docRef, {
        uid: selectedDriver.uid,
        email: selectedDriver.email,
        name: selectedDriver.name,
        startDate,
        endDate,
        totalDelivery: selectedDriver.totalDelivery,
        totalReturn: selectedDriver.totalReturn,
        totalCount: selectedDriver.totalCount,
        driverIncome: selectedDriver.driverIncome,
        totalFee: selectedDriver.totalFee,
        itkooFee,
        ids: Array.from(selectedDriver.ids),
        routes: Array.from(selectedDriver.routes),
        totalDeduction: totalDeduct,
        freshback,
        finalPay,
        deductions: {
          empDeduct: d.empDeduct || 0,
          indDeduct: d.indDeduct || 0,
          rentalDeduct: d.rentalDeduct || 0,
          damageDeduct: d.damageDeduct || 0,
          etcDeduct: d.etcDeduct || 0
        },
        createdAt: new Date()
      })
      alert('✅ 저장 완료')
    } catch (err) {
      console.error('❌ 저장 실패:', err)
      alert('❌ 저장 중 오류가 발생했습니다.')
    }
  }

  const exportPDF = () => {
    const pdfMake = pdfMakeRef.current
    if (!pdfMake || !selectedDriver) return
    const d = deductions[selectedDriver.uid] || {}
    const totalDeduct = (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
    const freshback = d.freshback || 0
    const finalPay = selectedDriver.driverIncome - totalDeduct + freshback

    const docDefinition = {
      content: [
        { text: '📄 잇쿠 기사 정산서', fontSize: 18, alignment: 'center', margin: [0, 0, 0, 10] },
        { text: `기사명: ${selectedDriver.name} (${selectedDriver.email})`, margin: [0, 10, 0, 2] },
        { text: `정산 기간: ${startDate} ~ ${endDate}`, margin: [0, 0, 0, 10] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              ['항목', '금액 (원)'],
              ['배송 건수', selectedDriver.totalDelivery],
              ['반품 건수', selectedDriver.totalReturn],
              ['총 건수', selectedDriver.totalCount],
              ['수행 실적 금액', selectedDriver.driverIncome.toLocaleString()],
              ['- 고용보험', `-${(d.empDeduct || 0).toLocaleString()}`],
              ['- 산재보험', `-${(d.indDeduct || 0).toLocaleString()}`],
              ['- 운송지원비', `-${(d.rentalDeduct || 0).toLocaleString()}`],
              ['- 파손/분실', `-${(d.damageDeduct || 0).toLocaleString()}`],
              ['- 기타 차감', `-${(d.etcDeduct || 0).toLocaleString()}`],
              ['프레시백 수익', freshback.toLocaleString()],
              ['▶ 실지급액', finalPay.toLocaleString()]
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      defaultStyle: { font: 'NotoSans' }
    }

    pdfMake.createPdf(docDefinition).download(`정산서_${selectedDriver.name}_${startDate}_${endDate}.pdf`)
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <TabNavigation />
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-blue-800">💸 기사별 실지급 정산</h1>

        {/* 날짜 범위 선택 */}
        <div className="relative mb-6">
          <label className="text-sm font-semibold mb-1 block text-gray-700">정산 기간 선택</label>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="border px-4 py-2 rounded w-60 text-left bg-white shadow-sm"
          >
            {`${format(range[0].startDate, 'yyyy.MM.dd')} ~ ${format(range[0].endDate, 'yyyy.MM.dd')}`}
          </button>

          {showPicker && (
            <div className="absolute z-50 mt-2 shadow-lg rounded border bg-white">
              <DateRange
                locale={ko}
                editableDateInputs={true}
                onChange={(item) => setRange([item.selection as RangeType])}
                moveRangeOnFirstSelection={false}
                ranges={range}
                rangeColors={['#0088FF']}
                maxDate={new Date()}
              />
              <div className="flex justify-between items-center p-2 border-t bg-gray-50">
                <div className="text-sm text-gray-700 px-2">
                  From <span className="font-semibold">{format(range[0].startDate, 'yyyy.MM.dd')}</span><br />
                  To <span className="font-semibold">{format(range[0].endDate, 'yyyy.MM.dd')}</span>
                </div>
                <button
                  onClick={() => setShowPicker(false)}
                  className="bg-[#0088FF] text-white px-4 py-2 rounded shadow"
                >
                  Set Date
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 기사 선택 */}
        <div className="mb-6">
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="border p-2 rounded w-64"
            disabled={!summary.length}
          >
            <option value="">{summary.length ? '기사 선택' : '먼저 날짜를 선택하세요'}</option>
            {driverList.map(d => (
              <option key={d.uid} value={d.uid}>{d.name} ({d.email})</option>
            ))}
          </select>
        </div>

        {/* 정산 카드 렌더링 */}
        {selectedDriver && (() => {
          const d = deductions[selectedDriver.uid] || {}
          const totalDeduct = (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
          const freshback = d.freshback || 0
          const finalPay = selectedDriver.driverIncome - totalDeduct + freshback

          return (
            <div className="border p-6 rounded bg-white shadow-lg">
              <h2 className="font-semibold text-lg text-blue-700 mb-2">{selectedDriver.name} / {selectedDriver.email}</h2>
              <p className="text-sm text-gray-600 mb-3">
                🛣 노선: {Array.from(selectedDriver.routes).join(', ')}<br />
                🆔 쿠팡ID: {Array.from(selectedDriver.ids).join(', ')}
              </p>

              <p className="text-sm mb-3 font-medium">
                📦 배송: {selectedDriver.totalDelivery}건 / 반품: {selectedDriver.totalReturn}건 / 총 {selectedDriver.totalCount}건<br />
                💰 기사수익: {selectedDriver.driverIncome.toLocaleString()}원<br />
              </p>

              <div className="grid gap-3 text-sm bg-gray-50 p-4 rounded border">
                {[ ['고용보험', 'empDeduct'], ['산재보험', 'indDeduct'], ['운송지원비', 'rentalDeduct'], ['파손/분실', 'damageDeduct'], ['기타 공제', 'etcDeduct'], ['프레시백 수익', 'freshback'] ].map(([label, key]) => (
                  <div key={key} className="flex justify-between items-center">
                    <label className="w-32 text-gray-700">{label}</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={d[key as keyof Deductions] ?? ''}
                      onChange={(e) => handleDeductionChange(key as keyof Deductions, e.target.value)}
                      className="border p-1 w-40 text-right rounded"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-green-50 border border-green-400 text-green-800 font-bold rounded text-center text-lg">
                ▶ 실지급액: {finalPay.toLocaleString()}원
              </div>

              <div className="flex gap-3 mt-5 justify-end">
                <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">💾 저장</button>
                <button onClick={exportPDF} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">📄 PDF 출력</button>
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}