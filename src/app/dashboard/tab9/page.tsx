// src/app/dashboard/tab9/page.tsx — 정산 허브 v2 (엑셀 업로드 → 기사×날짜×노선 집계 + DailyRecords 대조)
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import TabNavigation from '@/components/TabNavigation'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'

// ===== Types =====
interface DailyRecordDoc {
  uid: string
  name?: string
  email?: string
  deliveryDate: string // YYYY-MM-DD
  coupangId?: string
  shift?: string
  deliveryCount: number
  returnCount: number
  claimedRoutes?: string[]
}

interface StatementRow { // from Excel
  date: string // YYYY-MM-DD
  coupangId: string // lower
  routeCode: string // UPPER
  deliveries: number
  returns: number
  shift?: string
}

interface ReconRow {
  date: string
  coupangId: string
  driverName?: string
  routesFromExcel: string[]
  claimedRoutes?: string[]
  excelDeliveries: number
  excelReturns: number
  siteDeliveries: number
  siteReturns: number
  diffDeliveries: number
  diffReturns: number
  status: 'matched'|'mismatch'
}

// ===== Helpers =====
function toYMD(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}` }
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonthOpen = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1, 1)

function normalizeText(v: unknown): string { return typeof v === 'string' ? v.trim() : (v==null? '' : String(v).trim()) }
function lower(v: unknown): string { return normalizeText(v).toLowerCase() }
function upper(v: unknown): string { return normalizeText(v).toUpperCase() }

function parseExcelDate(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') {
    // Excel serial → JS date (days since 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    return toYMD(new Date(ms))
  }
  const s = normalizeText(v).replace(/\./g,'-').replace(/\//g,'-')
  const m = s.match(/^(\d{4})[-_]?(\d{1,2})[-_]?(\d{1,2})$/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]))
    return toYMD(d)
  }
  const d2 = new Date(s)
  return isNaN(d2.getTime()) ? undefined : toYMD(d2)
}

// Avoid type-only reference to 'xlsx' so build doesn't require its types at compile time.
let __XLSX: any = null
async function loadXLSX(): Promise<any> { if (__XLSX) return __XLSX; __XLSX = await import('xlsx'); return __XLSX }

function groupBy<T>(items: T[], keyFn: (t:T)=>string): Record<string, T[]> {
  const m: Record<string, T[]> = {}
  for (const it of items) { const k = keyFn(it); (m[k] ??= []).push(it) }
  return m
}

// ===== Page =====
export default function Tab9Recon() {
  // 기간 필터
  const [start, setStart] = useState<string>(() => toYMD(startOfMonth(new Date())))
  const [end, setEnd] = useState<string>(() => toYMD(endOfMonthOpen(new Date())))

  // 업로드된 엑셀 → 정규화 rows + 인덱스
  const [rows, setRows] = useState<StatementRow[]>([])
  const [routesByKey, setRoutesByKey] = useState<Record<string, string[]>>({}) // key=date|cid → uniq routes

  // DailyRecords (사이트 입력)
  const [siteMap, setSiteMap] = useState<Record<string, { deliveries: number; returns: number; name?: string; claimed?: string[] }>>({})

  // 표시/필터
  const [onlyMismatch, setOnlyMismatch] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const [msg, setMsg] = useState<string>('')

  // 1) Excel(.xlsx) 업로드 파서
  const onFile = async (f?: File) => {
    if (!f) return
    setMsg('엑셀 읽는 중...')
    try {
      const XLSX: any = await loadXLSX()
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName: string = wb.SheetNames.includes('정산Raw') ? '정산Raw' : wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const json: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (json.length === 0) { setRows([]); setRoutesByKey({}); setMsg('엑셀 시트가 비어 있습니다.'); return }

      // 헤더 추론: Route, 배송건수(파슬), 반품(운송장), ID, 배송일자, 배송유형(주간/심야)
      const norm = (s: string) => s.replace(/\s+/g,'').toLowerCase()
      const headers: string[] = Object.keys(json[0] ?? {})
      const findHeader = (cands: string[]): string | undefined => headers.find((h: string) => cands.some((c: string) => norm(h).includes(norm(c))))
      const H = {
        route: findHeader(['Route','노선']),
        del: findHeader(['배송건수','파슬','배송']),
        ret: findHeader(['반품','운송장']),
        id: findHeader(['ID','쿠팡ID','coupangid','cid']),
        date: findHeader(['배송일자','date','일자']),
        shift: findHeader(['배송유형','주간','심야','shift']),
      }

      const out: StatementRow[] = []
      const keyRoutes: Record<string, Set<string>> = {}
      for (const row of json) {
        const routeCode = upper((H.route ? row[H.route] : '') as string)
        const deliveries = Number(H.del ? row[H.del] : 0) || 0
        const returns = Number(H.ret ? row[H.ret] : 0) || 0
        const date = parseExcelDate(H.date ? row[H.date] : undefined)
        const cid = lower(H.id ? row[H.id] : '')
        const shift = normalizeText(H.shift ? row[H.shift] : '') || undefined
        // 스킵 조건
        if (!routeCode || !date || !cid) continue
        if (deliveries + returns === 0) continue
        // 기간 필터 내만 수집
        if (!(date >= start && date < end)) continue
        out.push({ date, coupangId: cid, routeCode, deliveries, returns, shift })
        const k = `${date}|${cid}`
        ;(keyRoutes[k] ??= new Set<string>()).add(routeCode)
      }
      setRows(out)
      const rmap: Record<string,string[]> = {}
      Object.keys(keyRoutes).forEach((k: string) => { rmap[k] = Array.from(keyRoutes[k] as Set<string>).sort() })
      setRoutesByKey(rmap)
      setMsg(`엑셀 로딩 완료: ${out.length} 행, 키 ${Object.keys(rmap).length}개`)
    } catch (e) {
      setMsg(`엑셀 읽기 오류: ${(e as Error).message}`)
    }
  }

  // 2) DailyRecords 불러오기 (기간)
  useEffect(() => {
    (async () => {
      setMsg('사이트 데이터 로딩...')
      const q1 = query(collection(db, 'DailyRecords'), where('deliveryDate','>=', start), where('deliveryDate','<', end))
      const snap = await getDocs(q1)
      const acc: Record<string, { deliveries: number; returns: number; name?: string; claimed?: string[] }> = {}
      snap.forEach(d => {
        const r = d.data() as DailyRecordDoc
        const date = r.deliveryDate
        const cid = (r.coupangId ?? '').toLowerCase()
        if (!date || !cid) return
        const key = `${date}|${cid}`
        const prev = acc[key] ?? { deliveries:0, returns:0, name: r.name, claimed: undefined }
        acc[key] = {
          deliveries: prev.deliveries + (Number(r.deliveryCount)||0),
          returns: prev.returns + (Number(r.returnCount)||0),
          name: prev.name ?? r.name,
          claimed: r.claimedRoutes ? Array.from(new Set([...(prev.claimed ?? []), ...r.claimedRoutes])) : prev.claimed
        }
      })
      setSiteMap(acc)
      setMsg('')
    })().catch(e => setMsg(`사이트 로딩 오류: ${(e as Error).message}`))
  }, [start, end])

  // 3) 대조 테이블 만들기
  const table: ReconRow[] = useMemo(() => {
    const byKey: Record<string, StatementRow[]> = groupBy(rows, (r: StatementRow) => `${r.date}|${r.coupangId}`)
    const keys = new Set<string>([...Object.keys(byKey), ...Object.keys(siteMap)])
    const out: ReconRow[] = []
    keys.forEach((k: string) => {
      const [date, cid] = k.split('|')
      const excel = byKey[k] ?? []
      const excelD = excel.reduce((s: number, r: StatementRow)=>s+r.deliveries,0)
      const excelR = excel.reduce((s: number, r: StatementRow)=>s+r.returns,0)
      const routes = routesByKey[k] ?? Array.from(new Set(excel.map((r: StatementRow)=>r.routeCode))).sort()
      const site = siteMap[k]
      const siteD = site?.deliveries ?? 0
      const siteR = site?.returns ?? 0
      const diffD = excelD - siteD
      const diffR = excelR - siteR
      const status: 'matched'|'mismatch' = (diffD===0 && diffR===0) ? 'matched' : 'mismatch'
      out.push({ date, coupangId: cid, driverName: site?.name, routesFromExcel: routes, claimedRoutes: site?.claimed, excelDeliveries: excelD, excelReturns: excelR, siteDeliveries: siteD, siteReturns: siteR, diffDeliveries: diffD, diffReturns: diffR, status })
    })
    out.sort((a: ReconRow,b: ReconRow)=> a.date===b.date ? a.coupangId.localeCompare(b.coupangId) : a.date.localeCompare(b.date))
    return out
  }, [rows, routesByKey, siteMap])

  const filtered = table.filter((r: ReconRow) => {
    if (onlyMismatch && r.status==='matched') return false
    if (!search.trim()) return true
    const s = search.trim().toLowerCase()
    return r.coupangId.includes(s) || (r.driverName?.toLowerCase().includes(s) ?? false) || r.routesFromExcel.some((rt: string)=>rt.toLowerCase().includes(s))
  })

  // 4) CSV 내보내기
  const exportCSV = () => {
    const headers = ['date','coupangId','driverName','routesFromExcel','claimedRoutes','excelDeliveries','excelReturns','siteDeliveries','siteReturns','diffDeliveries','diffReturns','status']
    const lines = [headers.join(',')]
    for (const r of filtered) {
      const row = [r.date, r.coupangId, r.driverName??'', r.routesFromExcel.join('|'), (r.claimedRoutes??[]).join('|'), r.excelDeliveries, r.excelReturns, r.siteDeliveries, r.siteReturns, r.diffDeliveries, r.diffReturns, r.status]
      lines.push(row.map((v)=>`${String(v).replace(/,/g,';')}`).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `reconcile_${start}_${end}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">정산 허브 (Tab9) — 엑셀 대조 · 기사×날짜×노선</h1>

        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">시작일</label>
            <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="border rounded p-2" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">종료일 (미포함)</label>
            <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="border rounded p-2" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">검색 (기사명/쿠팡ID/노선)</label>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} className="border rounded p-2" placeholder="예: cp1234, 302B, 정기주" />
          </div>
        </div>

        {/* Upload */}
        <div className="flex items-center gap-3">
          <input type="file" accept=".xlsx,.xls" onChange={(e)=>onFile(e.target.files?.[0])} />
          <label className="text-xs text-gray-500">시트명 <b>정산Raw</b> 를 자동 인식합니다. (없으면 첫 시트를 사용)</label>
          <label className="inline-flex items-center gap-2 ml-auto text-sm"><input type="checkbox" checked={onlyMismatch} onChange={(e)=>setOnlyMismatch(e.target.checked)} />Mismatch만</label>
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length===0}>CSV 내보내기</Button>
        </div>

        {msg && <div className="text-sm text-gray-700">{msg}</div>}

        {/* Table */}
        <div className="rounded-xl border bg-white overflow-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="p-2">날짜</th>
                <th className="p-2">쿠팡ID</th>
                <th className="p-2">기사명</th>
                <th className="p-2">엑셀 노선</th>
                <th className="p-2 text-right">엑셀 배송</th>
                <th className="p-2 text-right">엑셀 반품</th>
                <th className="p-2 text-right">사이트 배송</th>
                <th className="p-2 text-right">사이트 반품</th>
                <th className="p-2 text-right">Δ배송</th>
                <th className="p-2 text-right">Δ반품</th>
                <th className="p-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: ReconRow, idx:number)=> (
                <tr key={`${r.date}_${r.coupangId}_${idx}`} className="border-t">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.coupangId}</td>
                  <td className="p-2">{r.driverName ?? '-'}</td>
                  <td className="p-2">{r.routesFromExcel.join(', ')}</td>
                  <td className="p-2 text-right">{r.excelDeliveries}</td>
                  <td className="p-2 text-right">{r.excelReturns}</td>
                  <td className="p-2 text-right">{r.siteDeliveries}</td>
                  <td className="p-2 text-right">{r.siteReturns}</td>
                  <td className={`p-2 text-right ${r.diffDeliveries===0 ? '' : 'text-red-600 font-semibold'}`}>{r.diffDeliveries}</td>
                  <td className={`p-2 text-right ${r.diffReturns===0 ? '' : 'text-red-600 font-semibold'}`}>{r.diffReturns}</td>
                  <td className="p-2">
                    {r.status==='matched' ? <span className="px-2 py-1 rounded bg-green-50 text-green-700">Matched</span> : <span className="px-2 py-1 rounded bg-red-50 text-red-700">Mismatch</span>}
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td className="p-3 text-gray-500" colSpan={11}>표시할 데이터가 없습니다. 엑셀을 업로드하거나 기간/검색을 변경하세요.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500">
          ※ 엑셀에 노선이 누락된 행(프레시백 인센티브 등)은 자동 제외됩니다. DailyRecords의 <i>claimedRoutes</i>와 엑셀 노선이 다르면 분배 단계에서 참고하세요.
        </div>
      </main>
    </div>
  )
}