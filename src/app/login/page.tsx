'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    setMessage('')
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const user = result.user

      // Firestore에 사용자 정보 저장 (이미 존재하는지 확인 후)
      const userRef = doc(db, 'Users', user.uid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name: '', // 운영자가 나중에 설정 가능
          role: 'user', // 기본은 일반 사용자
          createdAt: new Date()
        })
      }

      setMessage('✅ 로그인 성공!')
      router.push('/dashboard/tab0') // 로그인 후 이동 경로
    } catch (error: any) {
      setMessage('❌ 로그인 실패: ' + error.message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">잇쿠 로그인</h1>
      <input
        type="email"
        placeholder="이메일"
        className="border px-4 py-2 mb-2 rounded w-80"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="비밀번호"
        className="border px-4 py-2 mb-4 rounded w-80"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 w-80"
      >
        로그인
      </button>
      {message && <p className="mt-4 text-sm text-center">{message}</p>}
    </div>
  )
}
