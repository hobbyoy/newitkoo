// src/app/dashboard/tab0/page.tsx (Figma 스타일 유지 + 멀티 노선 선택 대응)
'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
 * 이 파일은 기존 Figma UI를 유지하면서, "그날 탔던 모든 노선"을 다중 선택(claimedRoutes[])으로 저장하도록 리라이트되었습니다.
 * 또한 캔버스/샌드박스 환경에서 `@/lib/firebase` 경로가 해석되지 않는 문제를 피하기 위해
 * Firebase를 동적 임포트(상대→별칭 순)하는 `loadFirebase()`를 도입했습니다.
 * 실제 배포/로컬 레포에선 상대경로 또는 tsconfig paths 중 하나가 적용되어 정상 동작합니다.
 */

// ================= Types =================
interface RouteItem { routeCode: string; name?: string; active?: boolean }

interface DailyRecordDoc {
  uid: string
  email: string
  name: string
  deliveryDate: string
  coupangId: string
  // 단일 route 필드는 폐기하고, 기사 자기신고 노선 목록(claimedRoutes)로 대체
  claimedRoutes: string[]
  shift: string
  deliveryCount: number
  returnCount: number
  totalCount: number
  createdAt: unknown
}

// ================= Firebase 동적 로더 =================
let __firebase: { db: any; auth: any } | null = null
async function loadFirebase(): Promise<{ db: any; auth: any } | null> {
  if (__firebase) return __firebase
  try {
    // 프로젝트 구조 기준 상대경로 먼저 시도
    const modRel: any = await import('../../../lib/firebase')
    const db = modRel.db ?? modRel.default?.db
    const auth = modRel.auth ?? modRel.default?.auth
    if (db && auth) { __firebase = { db, auth }; return __firebase }
  } catch {}
  try {
    // tsconfig paths 적용 환경에서 별칭 경로 시도
    const modAlias: any = await import('@/lib/firebase')
    const db = modAlias.db ?? modAlias.default?.db
    const auth = modAlias.auth ?? modAlias.default?.auth
    if (db && auth) { __firebase = { db, auth }; return __firebase }
  } catch {}
  console.warn('[Tab0] Firebase 모듈을 로드하지 못했습니다. 프리뷰 모드로 동작합니다.')
  return null
}

// ================= 유틸 =================
const fmt = (d: Date) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const today = () => fmt(new Date())

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export default function Tab0() {
  // ===== 상태 =====
  const [form, setForm] = useState({
    date: '',
    coupangId: '',
    // route: ''  // ❌ 단일 노선 입력 제거
    shift: '',
    deliveryCount: '',
    returnCount: '',
  })
  const [claimedRoutes, setClaimedRoutes] = useState<string[]>([]) // ✅ 다중 노선 선택
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ [k: string]: boolean }>({})
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [envWarn, setEnvWarn] = useState<string>('')

  // 초기 날짜 = 오늘
  React.useEffect(() => { setForm((f) => ({ ...f, date: today() })) }, [])

  // 라우트 목록 로드
  useEffect(() => {
    (async () => {
      const fb = await loadFirebase()
      if (!fb) {
        setEnvWarn('Firebase 설정을 불러오지 못해 미리보기용 노선만 표시합니다. 배포 환경에선 tsconfig paths/상대경로를 확인하세요.')
        setRoutes([
          { routeCode: '302B', name: '테스트 302B', active: true },
          { routeCode: '308B02', name: '테스트 308B02', active: true },
          { routeCode: '111A', name: '테스트 111A', active: true },
          { routeCode: '111B', name: '테스트 111B', active: true },
        ])
        return
      }
      try {
        const snap = await getDocs(collection(fb.db, 'Routes'))
        const arr: RouteItem[] = []
        snap.forEach((d) => {
          const code = d.get('routeCode') as string | undefined
          const name = d.get('name') as string | undefined
          const active = d.get('active') as boolean | undefined
          if (code && (active === undefined || active)) arr.push({ routeCode: code, name, active: true })
        })
        arr.sort((a, b) => (a.routeCode < b.routeCode ? -1 : 1))
        setRoutes(arr)
      } catch (e) {
        console.error('[Tab0] Routes 로드 실패:', e)
        setEnvWarn('Routes 로드 오류: Firestore 권한/인터넷/경로를 확인하세요.')
      }
    })()
  }, [])

  // 합계 업데이트
  const updateTotal = (next: typeof form) => {
    const delivery = Number(next.deliveryCount || 0)
    const returns = Number(next.returnCount || 0)
    setTotalCount(delivery + returns)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const updated = { ...form, [name]: value }
    setForm(updated)
    updateTotal(updated)
    setErrors((prev) => ({ ...prev, [name]: false }))
  }

  // 저장 가능 여부
  const canSave = useMemo(() => {
    const errs: Record<string, boolean> = {}
    if (!isNonEmpty(form.date)) errs.date = true
    if (!isNonEmpty(form.coupangId)) errs.coupangId = true
    if (!isNonEmpty(form.shift)) errs.shift = true
    if (claimedRoutes.length === 0) errs.claimedRoutes = true
    setErrors((prev) => ({ ...prev, ...errs }))
    return Object.keys(errs).length === 0
  }, [form.date, form.coupangId, form.shift, claimedRoutes])

  // 저장
  const handleSubmit = async () => {
    if (!canSave) {
      setMessage('❗ 필수 입력 항목을 모두 작성해 주세요.')
      return
    }
    const fb = await loadFirebase()
    if (!fb) { setMessage('❌ Firebase 설정이 로드되지 않았습니다.'); return }

    const user = fb.auth.currentUser
    if (!user) { setMessage('❌ 로그인 상태가 아닙니다.'); return }

    const uid = user.uid
    const email = user.email || ''

    // 사용자 이름 조회 (없으면 공백)
    let name = ''
    try {
      const userSnap = await getDoc(doc(fb.db, 'Users', uid))
      name = (userSnap.exists() ? userSnap.data()?.name : '') || ''
    } catch {}

    // 기존 키는 uid|date|coupangId|route였지만, 이제 route 분해를 안 하므로 uid|date 키로 저장
    // (후속 월간/일간 분배는 DailySplits/MonthlyAllocations에서 관리)
    const key = `${uid}|${form.date}`
    const docRef = doc(fb.db, 'DailyRecords', key)
    const existing = await getDoc(docRef)
    if (existing.exists()) {
      setMessage('⚠️ 해당 날짜의 기록이 이미 존재합니다. 수정이 필요하면 운영자에게 문의하세요.')
      return
    }

    try {
      await setDoc(docRef, {
        uid,
        email,
        name,
        deliveryDate: form.date,
        coupangId: form.coupangId.trim().toLowerCase(),
        claimedRoutes: claimedRoutes.map((r) => r.trim()), // ✅ 기사 자기신고 노선 목록
        shift: form.shift,
        deliveryCount: Number(form.deliveryCount) || 0,
        returnCount: Number(form.returnCount) || 0,
        totalCount,
        createdAt: serverTimestamp(),
      } as DailyRecordDoc)

      setMessage('✅ 실적이 성공적으로 저장되었습니다!')
      setForm({ date: form.date, coupangId: '', shift: '', deliveryCount: '', returnCount: '' })
      setClaimedRoutes([])
      setTotalCount(0)
    } catch (err) {
      console.error(err)
      setMessage('❌ 저장에 실패했습니다.')
    }
  }

  // ================== UI ==================
  return (
    <div className="min-h-screen bg-white">
      <TabNavigation />
      <main className="max-w-md mx-auto py-10 px-4 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-normal text-black text-center font-sans">일일 운행 등록</h1>

        {/* 배송일 선택 (Figma 구성) */}
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
                  if (!d) return
                  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                  const ymd = local.toISOString().slice(0, 10)
                  setForm((f) => ({ ...f, date: ymd }))
                  setCalendarOpen(false)
                }}
                className="rounded-md"
                modifiersClassNames={{ selected: 'bg-[#0088FF] text-white' }}
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-red-500 text-xs mt-1">필수 입력입니다.</p>}
        </div>

        {/* 입력 필드 (Figma) */}
        <div className="flex flex-col w-[307px] gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">쿠팡배송 어플에서 사용한 ID</label>
            <Input
              name="coupangId"
              placeholder="예: cp1234"
              value={form.coupangId}
              onChange={handleChange}
              className={`h-[48px] px-3 text-sm ${errors.coupangId ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.coupangId && <p className="text-xs text-red-500 mt-1">필수 입력입니다.</p>}
          </div>

          {/* 🔁 변경점: 단일 노선 입력 → 멀티 노선 선택 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">그날 탔던 모든 노선</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between h-[48px] px-3 text-sm">
                  {claimedRoutes.length > 0 ? claimedRoutes.join(', ') : '노선을 선택하세요 (여러 개 가능)'}
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
        <Button
          onClick={handleSubmit}
          className="w-[85px] h-[41px] px-4 py-2 rounded-md border border-[#0088FF] bg-[#0088FF] text-white text-sm font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.15)] hover:brightness-110 transition-all"
        >
          저장하기
        </Button>

        {message && <p className="text-sm text-center text-gray-700 font-medium whitespace-pre-wrap">{message}</p>}
        {envWarn && <p className="text-xs text-center text-yellow-700 bg-yellow-50 border rounded px-2 py-1">{envWarn}</p>}
      </main>
    </div>
  )
}
