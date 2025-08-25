// src/app/dashboard/tab3/Tab3Client.tsx
// Figma 레이아웃 반영: 좌측 정보카드 / 우측 입력박스(빨강·파랑) 2열 + 하단 전체 폭 최종금액 블록
// 내부 컨텐츠 폭은 좌/우 모두 360px로 중앙 정렬

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
  setDoc,
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'
import notoVfs from '@/lib/fonts/noto-vfs'
import DateRangeBox from '@/components/tab3/DateRangeBox'
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

  const handleDeductionChange = (field: keyof Deductions, value: string) => {
    if (!selectedUid) return
    setDeductions(prev => ({
      ...prev,
      [selectedUid]: {
        ...prev[selectedUid],
        [field]: Number(value) || 0,
      },
    }))
  }

  const selectedDriver = useMemo(
    () => summary.find(d => d.uid === selectedUid),
    [summary, selectedUid]
  )

  // pdfmake + 한글 폰트 세팅 (변경 없음)
  useEffect(() => {
    const load = async () => {
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
    }
    load()
  }, [])

  // 기사 목록 (변경 없음)
  useEffect(() => {
    const loadDrivers = async () => {
      const snap = await getDocs(collection(db, 'Users'))
      const list = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<Driver, 'uid'>) }))
      setDriverList(list)
    }
    loadDrivers()
  }, [])

  // 기간 요약 로드 (변경 없음)
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
            totalFee: 0,
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
    <div className="bg-[#ffffff] min-h-screen">
      <TabNavigation />

      <main className="max-w-[1024px] mx-auto py-8 px-4">
        <h1 className="text-[12px] font-semibold text-black mb-4">기사별 실지급 정산</h1>

        {/* 상단: 날짜 / 기사 선택 (각 360px) */}
        <div className="flex flex-row items-center justify-center gap-4 mb-8">
          <div className="w-[360px]">
            <DateRangeBox
              onChange={(start, end) => {
                setStartDate(start)
                setEndDate(end)
              }}
            />
          </div>
          <div className="w-[360px]">
            <DriverSelectBox
              value={selectedUid}
              onChange={(uid) => setSelectedUid(uid)}
              options={driverList}
              disabled={!summary.length}
            />
          </div>
        </div>

        {/* 중단: 좌측(정보 카드) / 우측(입력 박스 2종) */}
        {selectedDriver ? (
          <section className="mx-auto max-w-[1024px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 좌: 정보 카드 (내용폭 360px) */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <div className="w-[360px] mx-auto">
                <h2 className="text-[28px] font-bold text-black mb-1">{selectedDriver.name}</h2>
                <p className="text-[16px] text-black">{selectedDriver.email}</p>
                <div className="mt-4 space-y-2 text-[14px] text-black">
                  <p>ROUTE LIST :</p>
                  <p>Coupang ID : {Array.from(selectedDriver.ids).join(', ')}</p>
                  <p>
                    배송 총 건수 : 배송 {selectedDriver.totalDelivery}건 / 반품 {selectedDriver.totalReturn}건 / 총 {selectedDriver.totalCount}건
                  </p>
                  <p className="font-semibold">기사수익 : {selectedDriver.driverIncome.toLocaleString()}원</p>
                </div>
              </div>
            </div>

            {/* 우: 입력 (빨간/파란 박스 각각 독립) */}
            <div className="space-y-6">
              {/* 🔴 기사부담 비용 입력 */}
              <div className="w-[360px] mx-auto">
                <DriverFeeBox
                  deductions={deductions[selectedDriver.uid] || {}}
                  onChange={(field, value) => handleDeductionChange(field, value)}
                />
              </div>

              {/* 🔵 기사 추가 수익 */}
              {(() => {
                const d = deductions[selectedDriver.uid] || {}
                return (
                  <div className="w-[360px] mx-auto">
                    <div className="rounded-2xl p-5 text-white bg-gradient-to-b from-[#58AFFF] to-[#007BFF]">
                      <h3 className="text-[16px] font-semibold text-center mb-4">기사 추가 수익</h3>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">기사 프레시백 수익</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          placeholder="기사 프레시백 수익"
                          value={(d.freshback ?? '').toString()}
                          onChange={(e) => handleDeductionChange('freshback', e.target.value)}
                          className="bg-white text-black px-3 py-2 rounded w-40 text-right"
                        />
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </section>
        ) : (
          <div className="mx-auto w-full max-w-[720px] bg-white rounded-2xl shadow p-10 text-center text-gray-500">
            기간과 기사를 선택하면 정산 카드가 표시됩니다.
          </div>
        )}

        {/* 하단: 최종 기사 실지급액 + 버튼 (가로 전체, 피그마 구조) */}
        {selectedDriver && (() => {
          const d = deductions[selectedDriver.uid] || {}
          const totalDeduct =
            (d.empDeduct || 0) + (d.indDeduct || 0) + (d.rentalDeduct || 0) + (d.damageDeduct || 0) + (d.etcDeduct || 0)
          const freshback = d.freshback || 0
          const finalPay = selectedDriver.driverIncome - totalDeduct + freshback

          return (
            <div className="mx-auto max-w-[1024px] mt-10">
              {/* 굵은 구분선 */}
              <div className="border-t-[6px] border-black my-8" />

              {/* 타이틀 / 금액 */}
              <div className="flex items-center justify-between">
                <span className="text-[24px] lg:text-[28px] font-semibold">최종 기사 실지급액</span>
                <span className="text-[28px] lg:text-[36px] font-bold">{finalPay.toLocaleString()}원</span>
              </div>

              {/* 버튼 (가운데) */}
              <div className="w-[360px] mx-auto mt-6 flex justify-center gap-3">
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
                  PDF 저장
                </button>

                <button
                  onClick={async () => {
                    const docRef = doc(db, 'FinalPayouts', `${selectedDriver.uid}_${startDate}_${endDate}`)
                    const exists = await getDoc(docRef)
                    if (exists.exists()) return alert('⚠️ 이미 저장된 정산 데이터입니다.')
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
                      itkooFee: selectedDriver.totalFee,
                      ids: Array.from(selectedDriver.ids),
                      routes: Array.from(selectedDriver.routes),
                      totalDeduction: totalDeduct,
                      freshback,
                      finalPay,
                      createdAt: new Date(), // (선택) serverTimestamp()로 교체 가능
                    })
                    alert('✅ 저장 완료')
                  }}
                  className="bg-black text-white px-5 py-2 rounded hover:opacity-90 text-sm"
                >
                  저장하기
                </button>
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

export default Tab3Client
