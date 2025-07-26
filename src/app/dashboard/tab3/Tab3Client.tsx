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

        <div className="mb-6">
          <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="border p-2 rounded w-64">
            <option value="">기사 선택</option>
            {driverList.map(d => (
              <option key={d.uid} value={d.uid}>{d.name} ({d.email})</option>
            ))}
          </select>
        </div>
      </main>
    </div>
  )
}