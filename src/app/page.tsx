// src/app/page.tsx

import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold mb-4">잇쿠 자동 정산 시스템</h1>
      <p className="mb-6 text-center text-gray-600">
        본 페이지는 로그인 후 사용 가능합니다.
      </p>
      <Link
        href="/login"
        className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800"
      >
        로그인 페이지로 이동 →
      </Link>
    </main>
  )
}
