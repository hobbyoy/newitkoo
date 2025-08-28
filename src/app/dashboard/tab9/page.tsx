// src/app/dashboard/tab9/page.tsx — 정산 허브 (월→일 노선 분배)
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import { Button } from '@/components/ui/button'

/**
 * Tab9: 운영자 정산 허브
 * - 입력: 월(YYYY-MM), 기사 선택, (선택) CSV 업로드(노선별 월합계)
 * - 데이터: DailyRecords(일별 총합), DriverRouteRates/Routes(허용 노선), RoutePrices(단가)
 * - 처리: 월→일 비례 분배(라운딩/제약/보정) → DailySplits 일괄 저장(+finalAmount)
 * - 주의: no-explicit-any 회피, prefer-const 준수
 */

// ============ Types ============
interface DailyRecordDoc {
  uid: string
  email?: string
  name?: string
  deliveryDate: string // YYYY-MM-DD
  coupangId?: string
  claimedRoutes?: string[]
  shift?: string
  deliveryCount: number
  returnCount: number
}

interface RateLink { // Tab8(단가 등록) 또는 Routes에서 읽는 연결 정보
  routeCode: string
  coupangId?: string
  shift?: string
  email?: string
  allowedUids?: string[]
  uid?: string
  name?: string
  active?: boolean
}

interface RoutePrice {
  routeCode: string
  unitPrice: number
  returnUnit?: number
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo?: string
}

interface DayTotal { deliveries: number; returns: number; claimed?: Set<string>; shift?: string; coupangId?: string }

interface AllocationMatrix { // route → date → count
  [routeCode: string]: { [date: string]: number }
}

interface RouteTotals { [routeCode: string]: { deliveries: number; returns: number } }

// ============ Utils ============
function monthRange(yyyyMM: string): { start: string; end: string } {
  const [y, m] = yyyyMM.split('-').map((v) => Number(v))
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  return { start: toISO(start), end: toISO(end) }
}

function toYMD(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const out: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cols = lines[i].split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? '').trim() })
    out.push(row)
  }
  return out
}

function sum<T>(arr: T[], f: (t: T) => number): number { return arr.reduce((s, v) => s + f(v), 0) }

function inRange(date: string, from: string, to?: string): boolean {
  return date >= from && (to ? date < to : true)
}

function pickPriceForDate(prices: RoutePrice[], route: string, date: string): { unit: number; ret: number } {
  const cand = prices
    .filter((p) => p.routeCode === route && inRange(date, p.effectiveFrom, p.effectiveTo))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))
  const p = cand[0]
  return { unit: p?.unitPrice ?? 0, ret: p?.returnUnit ?? 0 }
}

function cloneMatrix(m: AllocationMatrix): AllocationMatrix {
  const out: AllocationMatrix = {}
  for (const r of Object.keys(m)) out[r] = { ...m[r] }
  return out
}

// Largest Remainder 정수화
function largestRemainderInt(target: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights)
  const totals = sum(keys, (k) => weights[k])
  if (totals <= 0 || target <= 0) return Object.fromEntries(keys.map((k) => [k, 0]))
  const raw: Record<string, number> = {}
  const floored: Record<string, number> = {}
  for (const k of keys) {
    const v = (weights[k] / totals) * target
    raw[k] = v
    floored[k] = Math.floor(v)
  }
  let remain = target - sum(keys, (k) => floored[k])
  const order = keys.map((k) => ({ k, frac: raw[k] - floored[k] })).sort((a, b) => b.frac - a.frac)
  const out = { ...floored }
  for (let i = 0; i < order.length && remain > 0; i++) { out[order[i].k]++; remain-- }
  return out
}

// 비례 배분 + 마스크 + 일합 보정
function allocateCounts(
  days: string[],
  dayTotals: Record<string, number>,
  routes: string[],
  routeMonthly: Record<string, number>,
  allowed: Record<string, Set<string>> // date → allowed routes
): AllocationMatrix {
  const init: AllocationMatrix = {}
  const weightBase: Record<string, number> = {}
  for (const d of days) weightBase[d] = Math.max(0, dayTotals[d] ?? 0)

  for (const r of routes) {
    // allowed days
    const allowedDays = days.filter((d) => allowed[d]?.has(r))
    const weight: Record<string, number> = {}
    let sumAllowed = 0
    for (const d of allowedDays) { weight[d] = weightBase[d]; sumAllowed += weightBase[d] }
    // fallback: 허용일이 없으면 모든 day 허용
    if (allowedDays.length === 0 || sumAllowed === 0) {
      for (const d of days) weight[d] = weightBase[d]
    }
    init[r] = largestRemainderInt(routeMonthly[r] ?? 0, weight)
  }

  // day sum adjust
  const out = cloneMatrix(init)
  for (const d of days) {
    const target = dayTotals[d] ?? 0
    const now = sum(routes, (r) => out[r][d] ?? 0)
    let diff = target - now
    if (diff === 0) continue
    if (diff > 0) {
      // add +1 to routes with largest day weight and allowed
      const order = routes
        .filter((r) => allowed[d]?.has(r))
        .map((r) => ({ r, w: weightBase[d] })) // same weight; could be enhanced
        .sort((a, b) => b.w - a.w)
      let idx = 0
      while (diff > 0 && order.length > 0) {
        const r = order[idx % order.length].r
        out[r][d] = (out[r][d] ?? 0) + 1
        diff--
        idx++
      }
    } else {
      // remove -1 from routes with biggest current allocation
      const order = routes
        .filter((r) => (out[r][d] ?? 0) > 0)
        .map((r) => ({ r, v: out[r][d] }))
        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
      let idx = 0
      while (diff < 0 && order.length > 0) {
        const r = order[idx % order.length].r
        if ((out[r][d] ?? 0) > 0) { out[r][d]!--; diff++ }
        idx++
      }
    }
  }
  return out
}

// ============ Page ============
export default function Tab9Page() {
  // 필터 상태
  const [month, setMonth] = useState<string>(() => toYMD(new Date()).slice(0, 7))
  const [drivers, setDrivers] = useState<Array<{ uid: string; name: string; email?: string }>>([])
  const [selectedUid, setSelectedUid] = useState<string>('')

  // 일별 원본/합계
  const [dayMap, setDayMap] = useState<Record<string, DayTotal>>({})
  const [days, setDays] = useState<string[]>([])

  // 허용 노선 링크/가격
  const [rateLinks, setRateLinks] = useState<RateLink[]>([])
  const [prices, setPrices] = useState<RoutePrice[]>([])

  // 정산서 월합계 (노선별)
  const [routeTotals, setRouteTotals] = useState<RouteTotals>({})

  // 미리보기 결과
  const [allocD, setAllocD] = useState<AllocationMatrix>({}) // deliveries
  const [allocR, setAllocR] = useState<AllocationMatrix>({}) // returns
  const [msg, setMsg] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)

  // 1) 월의 기사 목록 + 일별 총합 로드
  useEffect(() => {
    (async () => {
      setMsg('')
      const { start, end } = monthRange(month)
      // DailyRecords에서 월 범위 내 문서 조회
      const q1 = query(collection(db, 'DailyRecords'), where('deliveryDate', '>=', start), where('deliveryDate', '<', end))
      const snap = await getDocs(q1)
      const byUid = new Map<string, { name: string; email?: string }>()
      const day: Record<string, DayTotal> = {}
      const daySet = new Set<string>()
      snap.forEach((d) => {
        const r = d.data() as DailyRecordDoc
        if (!r.uid || !r.deliveryDate) return
        if (!byUid.has(r.uid)) byUid.set(r.uid, { name: r.name ?? r.uid.slice(0, 6), email: r.email })
        if (!selectedUid || r.uid === selectedUid) {
          day[r.deliveryDate] ??= { deliveries: 0, returns: 0 }
          day[r.deliveryDate].deliveries += Number(r.deliveryCount || 0)
          day[r.deliveryDate].returns += Number(r.returnCount || 0)
          day[r.deliveryDate].shift = r.shift
          day[r.deliveryDate].coupangId = r.coupangId?.toLowerCase()
          if (Array.isArray(r.claimedRoutes) && r.claimedRoutes.length > 0) {
            day[r.deliveryDate].claimed = new Set(r.claimedRoutes)
          }
          daySet.add(r.deliveryDate)
        }
      })
      setDrivers(Array.from(byUid.entries()).map(([uid, v]) => ({ uid, name: v.name, email: v.email })))
      setDayMap(day)
      setDays(Array.from(daySet).sort())
    })().catch((e) => setMsg(`로드 오류: ${(e as Error).message}`))
  }, [month, selectedUid])

  // 2) Tab8 링크 / 가격 로드 (전수 후 필터)
  useEffect(() => {
    (async () => {
      const links: RateLink[] = []
      for (const col of ['DriverRouteRates', 'Routes', 'RouteRates', 'RoutePrices']) {
        try {
          const s = await getDocs(collection(db, col))
          s.forEach((r) => {
            const routeCode = (r.get('routeCode') as string) || ''
            if (!routeCode) return
            const link: RateLink = {
              routeCode,
              coupangId: (r.get('coupangId') as string | undefined)?.toLowerCase(),
              shift: (r.get('shift') as string | undefined) || undefined,
              email: (r.get('email') as string | undefined)?.toLowerCase() || (r.get('ownerEmail') as string | undefined)?.toLowerCase(),
              allowedUids: Array.isArray(r.get('allowedUids')) ? (r.get('allowedUids') as string[]) : undefined,
              uid: (r.get('uid') as string | undefined) || (r.get('ownerUid') as string | undefined) || undefined,
              name: (r.get('name') as string | undefined) || undefined,
              active: (typeof r.get('active') === 'boolean' ? (r.get('active') as boolean) : undefined)
            }
            links.push(link)
          })
          if (links.length > 0) break
        } catch {/* try next */}
      }
      setRateLinks(links)

      // 가격
      const pSnap = await getDocs(collection(db, 'RoutePrices'))
      const p: RoutePrice[] = []
      pSnap.forEach((x) => {
        const routeCode = x.get('routeCode') as string | undefined
        const unitPrice = x.get('unitPrice') as number | undefined
        const effectiveFrom = x.get('effectiveFrom') as string | undefined
        if (!routeCode || unitPrice == null || !effectiveFrom) return
        p.push({
          routeCode,
          unitPrice,
          returnUnit: (x.get('returnUnit') as number | undefined) ?? undefined,
          effectiveFrom,
          effectiveTo: (x.get('effectiveTo') as string | undefined) ?? undefined,
        })
      })
      setPrices(p)
    })().catch((e) => setMsg(`링크/가격 로드 오류: ${(e as Error).message}`))
  }, [])

  // 3) CSV 업로드 → routeTotals 설정
  const onFile = async (f?: File) => {
    if (!f) return
    const text = await f.text()
    const rows = parseCSV(text)
    const acc: RouteTotals = {}
    for (const r of rows) {
      const route = (r['routeCode'] || r['route'] || '').trim()
      if (!route) continue
      const del = Number(r['deliveries'] ?? r['delivery'] ?? 0) || 0
      const ret = Number(r['returns'] ?? r['return'] ?? 0) || 0
      acc[route] ??= { deliveries: 0, returns: 0 }
      acc[route].deliveries += del
      acc[route].returns += ret
    }
    setRouteTotals(acc)
  }

  // 4) 허용 노선 마스크(date→Set(route)) 계산
  const allowedMask = useMemo(() => {
    const mask: Record<string, Set<string>> = {}
    for (const d of days) {
      const base = new Set<string>()
      const info = dayMap[d]
      // 1) 기사 자기신고 노선 우선
      if (info?.claimed && info.claimed.size > 0) {
        info.claimed.forEach((r) => base.add(r))
      }
      // 2) Tab8/Routes 링크 기반 (coupangId/shift 매칭)
      const cid = info?.coupangId?.toLowerCase()
      const sh = info?.shift
      if (cid) {
        for (const l of rateLinks) {
          if (l.coupangId && l.coupangId !== cid) continue
          if (l.shift && sh && l.shift !== sh) continue
          if (l.active === false) continue
          base.add(l.routeCode)
        }
      }
      // 3) fallback: 아무 제약 없으면 routeTotals의 모든 노선 허용
      if (base.size === 0) {
        for (const r of Object.keys(routeTotals)) base.add(r)
      }
      mask[d] = base
    }
    return mask
  }, [days, dayMap, rateLinks, routeTotals])

  // 5) 미리보기 계산
  const preview = () => {
    if (!selectedUid) { setMsg('기사(UID)를 선택하세요.'); return }
    const dDays = days
    if (dDays.length === 0) { setMsg('해당 월에 DailyRecords가 없습니다.'); return }
    const dayDel: Record<string, number> = {}
    const dayRet: Record<string, number> = {}
    for (const d of dDays) { dayDel[d] = Math.max(0, dayMap[d]?.deliveries ?? 0); dayRet[d] = Math.max(0, dayMap[d]?.returns ?? 0) }
    const routes = Object.keys(routeTotals)
    if (routes.length === 0) { setMsg('정산서(월합계)를 업로드하거나 노선 합계를 입력하세요.'); return }
    const monthlyDel: Record<string, number> = {}
    const monthlyRet: Record<string, number> = {}
    for (const r of routes) { monthlyDel[r] = routeTotals[r].deliveries || 0; monthlyRet[r] = routeTotals[r].returns || 0 }

    const A = allocateCounts(dDays, dayDel, routes, monthlyDel, allowedMask)
    const B = allocateCounts(dDays, dayRet, routes, monthlyRet, allowedMask)
    setAllocD(A); setAllocR(B)
    setMsg('분배 미리보기를 생성했습니다.')
  }

  // 6) 저장 (DailySplits upsert)
  const save = async () => {
    if (!selectedUid) { setMsg('기사(UID)를 선택하세요.'); return }
    if (Object.keys(allocD).length === 0) { setMsg('먼저 미리보기를 생성하세요.'); return }
    setBusy(true)
    try {
      // 날짜별로 문서 작성
      for (const d of days) {
        const routeSplits: Array<{ routeCode: string; deliveries: number; returns: number; unitPrice?: number; amount?: number; returnUnit?: number }> = []
        for (const r of Object.keys(routeTotals)) {
          const deliveries = allocD[r]?.[d] ?? 0
          const returns = allocR[r]?.[d] ?? 0
          if (deliveries === 0 && returns === 0) continue
          const pr = pickPriceForDate(prices, r, d)
          const amount = deliveries * pr.unit - returns * pr.ret
          routeSplits.push({ routeCode: r, deliveries, returns, unitPrice: pr.unit, returnUnit: pr.ret, amount })
        }
        const finalAmount = sum(routeSplits, (x) => x.amount ?? 0)
        const ref = doc(db, 'DailySplits', `${d}_${selectedUid}`)
        await setDoc(ref, {
          id: `${d}_${selectedUid}`,
          date: d,
          driverId: selectedUid,
          routeSplits,
          finalAmount,
          splitStatus: 'applied',
          updatedAt: Date.now(),
          createdAt: Date.now(),
        })
      }
      setMsg('✅ DailySplits 저장 완료')
    } catch (e) {
      setMsg(`저장 오류: ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  // 실시간 합계 계산 (미리보기 UI 용)
  const daySumRow = (m: AllocationMatrix, d: string): number => sum(Object.keys(m), (r) => m[r]?.[d] ?? 0)
  const routeSumCol = (m: AllocationMatrix, r: string): number => sum(days, (d) => m[r]?.[d] ?? 0)

  // 드라이버 표시명
  const driverLabel = (u: { uid: string; name: string; email?: string }) => `${u.name}${u.email ? ` (${u.email})` : ''}`

  return (
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">정산 허브 — 월→일 노선 분배(Tab9)</h1>

        {/* 필터 */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-600">월(YYYY-MM)</label>
            <input value={month} onChange={(e) => setMonth(e.target.value)} type="month" className="border rounded p-2" />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm text-gray-600">기사(UID)</label>
            <div className="flex gap-2">
              <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="border rounded p-2 w-full">
                <option value="">선택</option>
                {drivers.map((d) => (<option key={d.uid} value={d.uid}>{driverLabel(d)}</option>))}
              </select>
              <Button variant="outline" onClick={() => { setRouteTotals({}); setAllocD({}); setAllocR({}); setMsg('') }}>초기화</Button>
            </div>
          </div>
        </div>

        {/* 월합계 입력/업로드 */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-gray-600">정산서 CSV 업로드 (routeCode,deliveries,returns)</label>
            <input type="file" accept=".csv" onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="text-xs text-gray-500">헤더 예시: <code>routeCode,deliveries,returns</code></div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-600">월합계 수동 입력</label>
            <MonthlyTotalsEditor totals={routeTotals} onChange={setRouteTotals} />
          </div>
        </div>

        {/* 원본 합계 vs 월합계 */}
        <div className="grid gap-3 md:grid-cols-2">
          <DailyTotalsCard days={days} dayMap={dayMap} />
          <RouteTotalsCard totals={routeTotals} />
        </div>

        {/* 미리보기 & 저장 */}
        <div className="flex gap-2">
          <Button onClick={preview} disabled={!selectedUid}>분배 미리보기</Button>
          <Button onClick={save} disabled={!selectedUid || Object.keys(allocD).length === 0 || busy}>{busy ? '저장 중…' : 'DailySplits 저장'}</Button>
          {msg && <div className="text-sm text-gray-700 ml-2">{msg}</div>}
        </div>

        {/* 매트릭스 미리보기 */}
        {Object.keys(allocD).length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">배송 분배 미리보기</h2>
            <MatrixTable days={days} routes={Object.keys(routeTotals)} matrix={allocD} rowTotal={(d) => dayMap[d]?.deliveries ?? 0} colTotal={(r) => routeTotals[r]?.deliveries ?? 0} />
            <h2 className="text-lg font-semibold">반품 분배 미리보기</h2>
            <MatrixTable days={days} routes={Object.keys(routeTotals)} matrix={allocR} rowTotal={(d) => dayMap[d]?.returns ?? 0} colTotal={(r) => routeTotals[r]?.returns ?? 0} />
          </div>
        )}
      </main>
    </div>
  )
}

// ============ Subcomponents ============
function DailyTotalsCard({ days, dayMap }: { days: string[]; dayMap: Record<string, DayTotal> }) {
  const totalD = sum(days, (d) => dayMap[d]?.deliveries ?? 0)
  const totalR = sum(days, (d) => dayMap[d]?.returns ?? 0)
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-sm font-medium mb-2">일자별 총합 (DailyRecords)</div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="py-1">날짜</th><th className="py-1 text-right">배송</th><th className="py-1 text-right">반품</th></tr></thead>
        <tbody>
          {days.map((d) => (
            <tr key={d} className="border-t">
              <td className="py-1">{d}</td>
              <td className="py-1 text-right">{dayMap[d]?.deliveries ?? 0}</td>
              <td className="py-1 text-right">{dayMap[d]?.returns ?? 0}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-1">합계</td>
            <td className="py-1 text-right">{totalD}</td>
            <td className="py-1 text-right">{totalR}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function RouteTotalsCard({ totals }: { totals: RouteTotals }) {
  const routes = Object.keys(totals)
  const td = sum(routes, (r) => totals[r].deliveries)
  const tr = sum(routes, (r) => totals[r].returns)
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-sm font-medium mb-2">정산서 월합계 (노선별)</div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="py-1">노선</th><th className="py-1 text-right">배송</th><th className="py-1 text-right">반품</th></tr></thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r} className="border-t">
              <td className="py-1">{r}</td>
              <td className="py-1 text-right">{totals[r].deliveries}</td>
              <td className="py-1 text-right">{totals[r].returns}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-1">합계</td>
            <td className="py-1 text-right">{td}</td>
            <td className="py-1 text-right">{tr}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MonthlyTotalsEditor({ totals, onChange }: { totals: RouteTotals; onChange: (t: RouteTotals) => void }) {
  const routes = Object.keys(totals)
  const [routeInput, setRouteInput] = useState<string>('')
  const [dVal, setDVal] = useState<string>('')
  const [rVal, setRVal] = useState<string>('')

  const add = () => {
    if (!routeInput.trim()) return
    const key = routeInput.trim().toUpperCase()
    const d = Number(dVal) || 0
    const r = Number(rVal) || 0
    onChange({ ...totals, [key]: { deliveries: d, returns: r } })
    setRouteInput(''); setDVal(''); setRVal('')
  }

  const remove = (k: string) => {
    const next: RouteTotals = {}
    for (const key of Object.keys(totals)) if (key !== k) next[key] = totals[key]
    onChange(next)
  }

  return (
    <div className="rounded-xl border p-3 bg-white space-y-2">
      <div className="flex gap-2">
        <input value={routeInput} onChange={(e) => setRouteInput(e.target.value)} placeholder="노선" className="border rounded p-2 w-32" />
        <input value={dVal} onChange={(e) => setDVal(e.target.value)} placeholder="배송" className="border rounded p-2 w-24 text-right" />
        <input value={rVal} onChange={(e) => setRVal(e.target.value)} placeholder="반품" className="border rounded p-2 w-24 text-right" />
        <Button onClick={add} variant="outline">추가</Button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="py-1">노선</th><th className="py-1 text-right">배송</th><th className="py-1 text-right">반품</th><th></th></tr></thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r} className="border-t">
              <td className="py-1">{r}</td>
              <td className="py-1 text-right">{totals[r].deliveries}</td>
              <td className="py-1 text-right">{totals[r].returns}</td>
              <td className="py-1 text-right"><Button variant="outline" onClick={() => remove(r)}>삭제</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatrixTable({ days, routes, matrix, rowTotal, colTotal }:
  { days: string[]; routes: string[]; matrix: AllocationMatrix; rowTotal: (d: string) => number; colTotal: (r: string) => number }) {
  const rowOk = (d: string) => rowTotal(d) === sum(routes, (r) => matrix[r]?.[d] ?? 0)
  const colOk = (r: string) => colTotal(r) === sum(days, (d) => matrix[r]?.[d] ?? 0)
  return (
    <div className="rounded-xl border p-3 bg-white overflow-auto">
      <table className="text-sm min-w-[720px] w-full">
        <thead>
          <tr className="text-left">
            <th className="py-1">날짜</th>
            {routes.map((r) => (
              <th key={r} className={`py-1 text-right ${colOk(r) ? '' : 'text-red-600'}`}>{r}</th>
            ))}
            <th className="py-1 text-right">합계</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d} className="border-t">
              <td className="py-1">{d}</td>
              {routes.map((r) => (
                <td key={r} className="py-1 text-right">{matrix[r]?.[d] ?? 0}</td>
              ))}
              <td className={`py-1 text-right ${rowOk(d) ? '' : 'text-red-600'}`}>{sum(routes, (r) => matrix[r]?.[d] ?? 0)} / {rowTotal(d)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="py-1">합계</td>
            {routes.map((r) => (
              <td key={r} className={`py-1 text-right ${colOk(r) ? '' : 'text-red-600'}`}>{sum(days, (d) => matrix[r]?.[d] ?? 0)} / {colTotal(r)}</td>
            ))}
            <td className="py-1 text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
