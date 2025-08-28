// src/app/dashboard/tab0/page.tsx (Figma 스타일 유지 + 멀티 노선 선택 + 계정 연동 필터)
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CalendarIcon, Check } from 'lucide-react'
import { ko } from 'date-fns/locale'

/**
 * 변경 요약
 * - 로그인한 사용자 계정에 연결된 **쿠팡ID만** 선택 가능
 * - 선택된 쿠팡ID + **해당 이메일(또는 UID)과 연결된 노선만** 멀티선택 가능
 * - DailyRecords 문서 키는 `${uid}|${date}`로 단순화(일 단위 입력)
 * - Figma UI 스타일 유지
 */

// ============ Types ============
interface RouteItem { routeCode: string; name?: string; active?: boolean }

interface DailyRecordDoc {
  uid: string
  email: string
  name: string
  deliveryDate: string            // YYYY-MM-DD
  coupangId: string               // 기사 입력값(소문자 저장)
  claimedRoutes: string[]         // 그날 탄 모든 노선
  shift: string                   // 주간/야간
  deliveryCount: number
  returnCount: number
  totalCount: number
  createdAt: unknown
}

// ============ Utils ============
const fmt = (d: Date): string => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const today = (): string => fmt(new Date())

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function ensureStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined
}

function canSaveRecord(params: {
  date: string
  coupangId: string
  shift: string
  claimedRoutes: string[]
}): boolean {
  const { date, coupangId, shift, claimedRoutes } = params
  return (
    isNonEmpty(date) &&
    isNonEmpty(coupangId) &&
    isNonEmpty(shift) &&
    Array.isArray(claimedRoutes) && claimedRoutes.length > 0
  )
}

// ============ Component ============
export default function Tab0() {
  // 폼 상태
  const [form, setForm] = useState({
    date: today(),
    coupangId: '', // ✅ 드롭다운으로 제한 선택
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })
  const [claimedRoutes, setClaimedRoutes] = useState<string[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  // 로그인 사용자 정보
  const [uid, setUid] = useState<string>('')
  const [email, setEmail] = useState<string>('')

  // 계정 연동 정보
  const [availableCoupangIds, setAvailableCoupangIds] = useState<string[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])

  // ===== 초기 인증/연동 정보 로딩 =====
  useEffect(() => {
    const u = auth.currentUser
    if (!u) {
      setMessage('❌ 로그인 상태가 아닙니다.')
      return
    }
    const userUid = u.uid
    const userEmail = (u.email || '').toLowerCase()
    setUid(userUid)
    setEmail(userEmail)

    // 1) Users/{uid}에서 coupangIds를 우선 로드
    ;(async () => {
      let ids: string[] = []
      try {
        const userDoc = await getDoc(doc(db, 'Users', userUid))
        if (userDoc.exists()) {
          const data = userDoc.data() as Record<string, unknown>
          const fromUser =
            ensureStringArray(data['coupangIds']) ??
            ensureStringArray(data['coupang_id_list']) ??
            ensureStringArray(data['coupangIdList'])
          if (fromUser) ids = fromUser.map((c) => c.toLowerCase())
        }
      } catch {/* ignore */}

      // 2) Users에 없으면 Routes에서 이메일/UID 매칭으로 역추적
      if (ids.length === 0) {
        try {
          const snap = await getDocs(collection(db, 'Routes'))
          const setIds = new Set<string>()
          snap.forEach((r) => {
            const rEmailRaw = (r.get('email') || r.get('ownerEmail') || r.get('operatorEmail') || '')
            const rEmail = typeof rEmailRaw === 'string' ? rEmailRaw.toLowerCase() : ''
            const allowedRaw = r.get('allowedUids')
            const allowedUids = Array.isArray(allowedRaw) ? allowedRaw.filter((x) => typeof x === 'string') as string[] : undefined

            const cidField = r.get('coupangId') ?? r.get('coupangID') ?? r.get('cid')
            let cid = typeof cidField === 'string' ? cidField.trim() : ''
            if (!cid) {
              // doc id에서 추출 (ROUTE_CPID)
              const id = r.id
              const idx = id.indexOf('_')
              if (idx >= 0) cid = id.slice(idx + 1)
            }
            if (!cid) return

            const passEmail = rEmail ? rEmail === userEmail : false
            const passUid = Array.isArray(allowedUids) ? allowedUids.includes(userUid) : false
            if (passEmail || passUid) {
              setIds.add(cid.toLowerCase())
            }
          })
          ids = Array.from(setIds)
        } catch {/* ignore */}
      }

      ids.sort((a, b) => (a < b ? -1 : 1))
      setAvailableCoupangIds(ids)

      // 하나뿐이면 자동 선택
      if (ids.length === 1) setForm((f) => ({ ...f, coupangId: ids[0] }))
    })()
  }, [])

  // 선택한 쿠팡ID + 사용자 이메일/UID 기준으로 노선 필터
  useEffect(() => {
    if (!form.coupangId || !email) { setRoutes([]); setClaimedRoutes([]); return }
    ;(async () => {
      try {
        const snap = await getDocs(collection(db, 'Routes'))
        const arr: RouteItem[] = []
        snap.forEach((r) => {
          // coupangId 판단
          const rCidField = r.get('coupangId') ?? r.get('coupangID') ?? r.get('cid')
          let rCid = typeof rCidField === 'string' ? rCidField.trim().toLowerCase() : ''
          if (!rCid) {
            const id = r.id
            const idx = id.indexOf('_')
            if (idx >= 0) rCid = id.slice(idx + 1).toLowerCase()
          }
          if (rCid !== form.coupangId.toLowerCase()) return

          // 이메일/UID 매칭
          const rEmailRaw = (r.get('email') || r.get('ownerEmail') || r.get('operatorEmail') || '')
          const rEmail = typeof rEmailRaw === 'string' ? rEmailRaw.toLowerCase() : ''
          const allowedRaw = r.get('allowedUids')
          const allowedUids = Array.isArray(allowedRaw) ? allowedRaw.filter((x) => typeof x === 'string') as string[] : undefined
          const emailOrUidOk = rEmail ? rEmail === email : Array.isArray(allowedUids) ? allowedUids.includes(uid) : true
          if (!emailOrUidOk) return

          // routeCode 파싱
          const codeField = r.get('routeCode')
          let code = typeof codeField === 'string' ? codeField : ''
          if (!code) {
            const id = r.id
            const idx = id.indexOf('_')
            code = (idx >= 0 ? id.slice(0, idx) : id) || ''
          }
          if (!code) return

          const nameField = r.get('name')
          const name = typeof nameField === 'string' ? nameField : undefined
          const activeField = r.get('active')
          const active = typeof activeField === 'boolean' ? activeField : undefined
          if (active === undefined || active === true) {
            arr.push({ routeCode: code, name, active: true })
          }
        })
        arr.sort((a, b) => (a.routeCode < b.routeCode ? -1 : 1))
        setRoutes(arr)
        setClaimedRoutes([]) // 쿠팡ID 바뀌면 선택 초기화
      } catch (e) {
        console.error('[Tab0] Routes filter load error:', e)
        setRoutes([])
        setClaimedRoutes([])
      }
    })()
  }, [form.coupangId, email, uid])

  // 합계 업데이트
  const updateTotal = (delivery: string, returns: string) => {
    const d = Number(delivery || 0)
    const r = Number(returns || 0)
    setTotalCount(d + r)
  }

  // 입력 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const next = { ...form, [name]: value }
    setForm(next)
    if (name === 'deliveryCount' || name === 'returnCount') {
      updateTotal(next.deliveryCount, next.returnCount)
    }
    setErrors((prev) => ({ ...prev, [name]: false }))
  }

  // 저장 가능 여부
  const canSave = useMemo(
    () => canSaveRecord({ date: form.date, coupangId: form.coupangId, shift: form.shift, claimedRoutes }),
    [form.date, form.coupangId, form.shift, claimedRoutes]
  )

  // 저장
  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {}
    if (!form.date) newErrors.date = true
    if (!form.coupangId) newErrors.coupangId = true
    if (!form.shift) newErrors.shift = true
    if (claimedRoutes.length === 0) newErrors.claimedRoutes = true
    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }))
      setMessage('❗ 필수 입력 항목을 모두 작성해 주세요.')
      return
    }

    const user = auth.currentUser
    if (!user) { setMessage('❌ 로그인 상태가 아닙니다.'); return }

    const userUid = user.uid
    const userEmail = (user.email || '').toLowerCase()

    // 사용자 이름
    let name = ''
    try {
      const userDoc = await getDoc(doc(db, 'Users', userUid))
      if (userDoc.exists()) {
        const d = userDoc.data() as Record<string, unknown>
        const n = d['name']
        name = typeof n === 'string' ? n : ''
      }
    } catch {/* ignore */}

    // 키: uid|date (일 단위 저장)
    const recId = `${userUid}|${form.date}`
    const recRef = doc(db, 'DailyRecords', recId)
    const existing = await getDoc(recRef)
    if (existing.exists()) { setMessage('⚠️ 이미 해당 날짜의 기록이 있습니다.'); return }

    try {
      const deliveryCountNum = Number(form.deliveryCount) || 0
      const returnCountNum = Number(form.returnCount) || 0
      await setDoc(recRef, {
        uid: userUid,
        email: userEmail,
        name,
        deliveryDate: form.date,
        coupangId: form.coupangId.trim().toLowerCase(),
        claimedRoutes: claimedRoutes.map((r) => r.trim()),
        shift: form.shift,
        deliveryCount: deliveryCountNum,
        returnCount: returnCountNum,
        totalCount: deliveryCountNum + returnCountNum,
        createdAt: serverTimestamp(),
      } as DailyRecordDoc)

      setMessage('✅ 실적이 성공적으로 저장되었습니다!')
      setForm((f) => ({ ...f, coupangId: f.coupangId, shift: '', deliveryCount: '', returnCount: '' }))
      setClaimedRoutes([])
      setTotalCount(0)
    } catch (err) {
      console.error(err)
      setMessage('❌ 저장에 실패했습니다.')
    }
  }

  // ============ UI ============
  return (
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-md mx-auto py-10 px-4 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-normal text-black text-center font-sans">일일 운행 등록</h1>

        {/* 배송일 선택 */}
        <div className="w-[307px]">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full h-[48px] bg-white rounded-lg shadow-[0_0_14px_rgba(0,0,0,0.13)] flex items-center justify-between px-4 text-left text-sm font-normal">
                {form.date || '배송일 선택'}
                <CalendarIcon className="w-4 h-4 text-gray-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[307px] h-[332px] p-5 flex justify-center items-center gap-5 rounded-[11px] bg-white shadow-[0_0_14px_rgba(0,0,0,0.07)]">
              <Calendar
                mode="single"
                locale={ko}
                selected={form.date ? new Date(form.date + 'T00:00:00') : undefined}
                onSelect={(d) => {
                  if (d) {
                    const offset = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    setForm((f) => ({ ...f, date: offset.toISOString().slice(0, 10) }))
                    setCalendarOpen(false)
                  }
                }}
                className="rounded-md"
                modifiersClassNames={{ selected: 'bg-[#0088FF] text-white' }}
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}
        </div>

        {/* 입력 필드들 */}
        <div className="flex flex-col w-[307px] gap-4">
          {/* 쿠팡ID: 계정 연동 목록만 선택 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">쿠팡배송 어플에서 사용한 ID</label>
            <select
              name="coupangId"
              value={form.coupangId}
              onChange={handleChange}
              className={`h-[48px] px-3 text-sm border rounded-lg ${errors.coupangId ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">선택하세요</option>
              {availableCoupangIds.map((cid) => (
                <option key={cid} value={cid}>{cid}</option>
              ))}
            </select>
            {availableCoupangIds.length === 0 && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border rounded px-2 py-1 mt-1">이 계정과 연결된 쿠팡ID가 없습니다. 운영자에게 권한 등록을 요청하세요.</p>
            )}
            {errors.coupangId && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
          </div>

          {/* 🔁 단일 노선 입력 → 멀티 노선 선택 (선택된 쿠팡ID + 이메일/UID 매칭 필터) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">그날 탔던 모든 노선</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between h-[48px] px-3 text-sm" disabled={!form.coupangId || routes.length === 0}>
                  {claimedRoutes.length > 0 ? claimedRoutes.join(', ') : (form.coupangId ? '노선을 선택하세요 (여러 개 가능)' : '먼저 쿠팡ID를 선택하세요')}
                  <svg width="16" height="16" viewBox="0 0 20 20" className="opacity-60"><path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[307px] p-2 rounded-lg shadow-[0_0_14px_rgba(0,0,0,0.07)]">
                <div className="max-h-56 overflow-auto">
                  {routes.map((r) => {
                    const checked = claimedRoutes.includes(r.routeCode)
                    return (
                      <button
                        key={r.routeCode}
                        type="button"
                        onClick={() => {
                          setClaimedRoutes((prev) => checked ? prev.filter((x) => x !== r.routeCode) : [...prev, r.routeCode])
                          setErrors((p) => ({ ...p, claimedRoutes: false }))
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                      >
                        <span>{r.routeCode}{r.name ? ` — ${r.name}` : ''}</span>
                        {checked && <Check className="w-4 h-4 text-[#0088FF]" />}
                      </button>
                    )
                  })}
                  {form.coupangId && routes.length === 0 && (
                    <div className="text-xs text-gray-600 px-2 py-1">선택한 쿠팡ID와 연결된 노선이 없습니다.</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {errors.claimedRoutes && <p className="text-xs text-red-500 mt-1">최소 1개 이상의 노선을 선택하세요.</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">배송건수</label>
            <Input
              name="deliveryCount"
              type="number"
              placeholder="예: 150"
              value={form.deliveryCount}
              onChange={handleChange}
              className="h-[48px] px-3 text-sm border-gray-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">반품건수</label>
            <Input
              name="returnCount"
              type="number"
              placeholder="예: 5"
              value={form.returnCount}
              onChange={handleChange}
              className="h-[48px] px-3 text-sm border-gray-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">주야간 선택</label>
            <ToggleGroup
              type="single"
              value={form.shift}
              onValueChange={(value) => setForm({ ...form, shift: value || '' })}
              className="w-full h-[48px] flex px-[3px] py-[3px] border border-gray-300 rounded-lg bg-white"
            >
              <ToggleGroupItem
                value="주간"
                className={`flex items-center justify-center w-1/2 text-sm font-medium rounded-[12px] transition-all ${
                  form.shift === '주간'
                    ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
                    : 'text-gray-700'
                }`}
              >
                주간
              </ToggleGroupItem>

              <ToggleGroupItem
                value="야간"
                className={`flex items-center justify-center w-1/2 text-sm font-medium rounded-[12px] transition-all ${
                  form.shift === '야간'
                    ? 'bg-[#0088FF] text-white shadow-[0_1px_1px_rgba(0,0,0,0.19),0_2px_2px_rgba(0,0,0,0.25)]'
                    : 'text-gray-700'
                }`}
              >
                야간
              </ToggleGroupItem>
            </ToggleGroup>
            {errors.shift && <p className="text-xs text-red-500 mt-1">필수 선택입니다.</p>}
          </div>
        </div>

        {/* 합계 미리보기 */}
        <div className="text-sm text-gray-600">총합계: <b>{totalCount}</b> 건 (배송 + 반품)</div>

        {/* 저장 버튼 */}
        <Button onClick={handleSubmit} disabled={!canSave}
          className="w-[85px] h-[41px] px-4 py-2 rounded-md border border-[#0088FF] bg-[#0088FF] text-white text-sm font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.15)] hover:brightness-110 transition-all"
        >
          저장하기
        </Button>

        {message && <p className="text-sm text-center text-gray-700 font-medium whitespace-pre-wrap">{message}</p>}
      </main>
    </div>
  )
}

// ============ Lightweight in-browser tests ============
function __assert(name: string, cond: boolean) {
  if (!cond) console.error(`[Tab0 tests] ❌ ${name}`); else console.log(`[Tab0 tests] ✅ ${name}`)
}

if (typeof window !== 'undefined') {
  try {
    __assert('today() returns YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(today()))
    __assert('canSaveRecord blocks empty routes', canSaveRecord({ date: '2025-08-01', coupangId: 'cp1', shift: '주간', claimedRoutes: [] }) === false)
    __assert('canSaveRecord ok with one route', canSaveRecord({ date: '2025-08-01', coupangId: 'cp1', shift: '주간', claimedRoutes: ['302B'] }) === true)
  } catch (e) {
    console.warn('[Tab0 tests] Skipped due to runtime environment:', e)
  }
}
