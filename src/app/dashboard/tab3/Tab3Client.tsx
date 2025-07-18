// src/app/dashboard/tab3/Tab3Client.tsx

'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, doc, getDoc, setDoc,
} from 'firebase/firestore'
import useRoleGuard from '@/hooks/useRoleGuard'
import TabNavigation from '@/components/TabNavigation'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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
  totalCount: number
  driverIncome: number
}

const styles = StyleSheet.create({
  page: { padding: 30 },
  section: { marginBottom: 12 },
  title: { fontSize: 18, marginBottom: 10, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontWeight: 'bold' },
})

function MyPDF({ data }: { data: Summary }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>📄 잇쿠 기사 정산서</Text>
        <View style={styles.section}>
          <Text>기사명: {data.name}</Text>
          <Text>이메일: {data.email}</Text>
          <Text>총 건수: {data.totalCount}건</Text>
          <Text>기사 수익: {data.driverIncome.toLocaleString()}원</Text>
        </View>
      </Page>
    </Document>
  )
}

export default function Tab3Client() {
  useRoleGuard('admin')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [driverList, setDriverList] = useState<Driver[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [selectedUid, setSelectedUid] = useState('')

  const selectedDriver = summary.find(d => d.uid === selectedUid)

  useEffect(() => {
    const loadDrivers = async () => {
      const snap = await getDocs(collection(db, 'Users'))
      const list = snap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<Driver, 'uid'>) }))
      setDriverList(list)
    }
    loadDrivers()
  }, [])

  useEffect(() => {
    const loadSummary = async () => {
      if (!startDate || !endDate) return
      const q = query(collection(db, 'DailyRecords'),
        where('deliveryDate', '>=', startDate),
        where('deliveryDate', '<=', endDate))
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
            totalCount: 0,
            driverIncome: 0
          }
        }

        const total = item.deliveryCount + item.returnCount
        const routeKey = `${item.route}_${item.coupangId}`.toUpperCase()
        const routeSnap = await getDoc(doc(db, 'Routes', routeKey))
        const unitPrice = routeSnap.exists() ? (routeSnap.data() as RouteUnit).driverUnitPrice : 0

        map[key].totalCount += total
        map[key].driverIncome += total * unitPrice
      }

      setSummary(Object.values(map))
    }

    loadSummary()
  }, [startDate, endDate])

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-6 text-blue-700">💸 기사별 정산 PDF 출력 (tab3)</h1>

        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label>시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2" />
          </div>
          <div>
            <label>종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2" />
          </div>
          <div>
            <label>기사 선택</label>
            <select value={selectedUid} onChange={e => setSelectedUid(e.target.value)} className="border p-2 w-72">
              <option value="">기사 선택</option>
              {driverList.map(d => (
                <option key={d.uid} value={d.uid}>{d.email} / {d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedDriver && (
          <div className="border p-4 rounded bg-gray-50">
            <p className="mb-2 text-sm">총 건수: {selectedDriver.totalCount}건</p>
            <p className="mb-4 text-sm">기사 수익: {selectedDriver.driverIncome.toLocaleString()}원</p>
            <PDFDownloadLink
              document={<MyPDF data={selectedDriver} />}
              fileName={`정산서_${selectedDriver.name}_${startDate}_${endDate}.pdf`}
            >
              {({ loading }) => (
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                  {loading ? 'PDF 생성 중...' : '📄 PDF 다운로드'}
                </button>
              )}
            </PDFDownloadLink>
          </div>
        )}
      </main>
    </div>
  )
}
