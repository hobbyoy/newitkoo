'use client'

import { useState, useEffect, useRef } from 'react'
import useRoleGuard from '@/hooks/useRoleGuard'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs,
  doc, getDoc, setDoc
} from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import notoVfs from '@/lib/fonts/noto-vfs'

type PdfMakeType = {
  createPdf: (docDefinition: object) => {
    download: (filename?: string) => void
  }
  vfs?: Record<string, string>
  fonts?: {
    [fontName: string]: {
      normal: string
      bold: string
      italics: string
      bolditalics: string
    }
  }
}

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
}

interface Deductions {
  insEmp: number
  insInd: number
  rental: number
  damage: number
  etc: number
  freshback: number
}

export default function Tab3Client() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [driverList, setDriverList] = useState<Driver[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [deductions, setDeductions] = useState<Record<string, Partial<Deductions>>>({})
  const pdfMakeRef = useRef<PdfMakeType | null>(null)

  const selectedDriver = summary.find((d) => d.uid === selectedUid)

  useEffect(() => {
    const loadPdf = async () => {
      if (typeof window === 'undefined') return
      const pdfModule = await import('pdfmake/build/pdfmake')
      const pdfMake = (pdfModule.default || pdfModule) as PdfMakeType
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
    loadPdf()
  }, [])

  const handleDeductionChange = (field: keyof Deductions, value: string) => {
    if (!selectedUid) return
    setDeductions(prev => ({
      ...prev,
      [selectedUid]: {
        ...prev[selectedUid],
        [field]: Number(value) || 0
      }
    }))
  }

  const handleSave = async () => {
    if (!selectedDriver || !startDate || !endDate) return
    const d = deductions[selectedDriver.uid] || {}
    const totalDeduct = (d.insEmp || 0) + (d.insInd || 0) + (d.rental || 0) + (d.damage || 0) + (d.etc || 0)
    const freshback = d.freshback || 0
    const finalPay = selectedDriver.driverIncome - totalDeduct + freshback
    const docId = `${selectedDriver.uid}|${startDate}~${endDate}`

    await setDoc(doc(db, 'FinalPayouts', docId), {
      uid: selectedDriver.uid,
      email: selectedDriver.email,
      name: selectedDriver.name,
      startDate,
      endDate,
      totalDelivery: selectedDriver.totalDelivery,
      totalReturn: selectedDriver.totalReturn,
      totalCount: selectedDriver.totalCount,
      driverIncome: selectedDriver.driverIncome,
      totalDeduction: totalDeduct,
      freshback,
      finalPay,
      deductions: {
        insEmp: d.insEmp || 0,
        insInd: d.insInd || 0,
        rental: d.rental || 0,
        damage: d.damage || 0,
        etc: d.etc || 0
      },
      createdAt: new Date()
    })

    alert('✅ 정산 결과 저장 완료')
  }

  const handleExportPDF = () => {
    const pdfMake = pdfMakeRef.current
    if (!pdfMake || !selectedDriver) return
    const d = deductions[selectedDriver.uid] || {}
    const totalDeduct = (d.insEmp || 0) + (d.insInd || 0) + (d.rental || 0) + (d.damage || 0) + (d.etc || 0)
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
              ['기사 수익', selectedDriver.driverIncome.toLocaleString()],
              ['고용보험', (d.insEmp || 0).toLocaleString()],
              ['산재보험', (d.insInd || 0).toLocaleString()],
              ['운송지원비', (d.rental || 0).toLocaleString()],
              ['파손/분실', (d.damage || 0).toLocaleString()],
              ['기타 차감', (d.etc || 0).toLocaleString()],
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

  const loadDrivers = async () => {
    const snap = await getDocs(collection(db, 'Users'))
    const list = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<Driver, 'uid'>) }))
    setDriverList(list)
  }

  const loadSummary = async () => {
    if (!startDate || !endDate) return
    const q = query(collection(db, 'DailyRecords'), where('deliveryDate', '>=', startDate), where('deliveryDate', '<=', endDate))
    const snap = await getDocs(q)
    const raw: RecordData[] = snap.docs.map(doc => doc.data() as RecordData)

    const map: Record<string, Summary> = {}

    for (const item of raw) {
      const key = item.uid
      if (!map[key]) {
        map[key] = {
          uid: key,
          email: item.email,
          name: item.name,
          ids: new Set(),
          routes: new Set(),
          totalDelivery: 0,
          totalReturn: 0,
          totalCount: 0,
          driverIncome: 0
        }
      }

      const delivery = item.deliveryCount
      const returns = item.returnCount
      const total = delivery + returns

      const unitKey = `${item.route}_${item.coupangId}`.toUpperCase()
      const unitSnap = await getDoc(doc(db, 'Routes', unitKey))
      const price = unitSnap.exists() ? (unitSnap.data() as RouteUnit).driverUnitPrice : 0

      map[key].routes.add(item.route)
      map[key].ids.add(item.coupangId)
      map[key].totalDelivery += delivery
      map[key].totalReturn += returns
      map[key].totalCount += total
      map[key].driverIncome += total * price
    }

    setSummary(Object.values(map))
  }

  useEffect(() => { loadDrivers() }, [])
  useEffect(() => { if (startDate && endDate) loadSummary() }, [startDate, endDate])

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-4xl mx-auto">
        {/* ✅ UI 생략 가능, 정산 페이지 확인되면 확장 */}
        <h1 className="text-xl font-bold text-blue-700">tab3 정상 작동 확인</h1>
      </main>
    </div>
  )
}
