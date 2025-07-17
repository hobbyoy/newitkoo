'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { FirebaseError } from 'firebase/app'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    setMessage('⏳ 로그인 시도 중...')
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const user = result.user

      if (!user) {
        setMessage('❌ 로그인 실패: 사용자 정보 없음')
        return
      }

      const userData = {
        uid: user.uid,
        email: user.email,
        name: '',
        role: 'user',
        createdAt: new Date()
      }

      // 사용자 인증 확정될 때까지 기다리기
      await new Promise<void>((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
          if (firebaseUser?.uid === user.uid) {
            unsubscribe()
            resolve()
          }
        })
      })

      const userRef = doc(db, 'Users', user.uid)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        await setDoc(userRef, userData)
      }

      setMessage('✅ 로그인 성공!')
      router.push('/dashboard/tab0')
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setMessage('❌ 로그인 실패: ' + error.message)
      } else {
        setMessage('❌ 로그인 실패: 알 수 없는 오류')
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">잇쿠 로그인</h1>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-4 py-2 mb-2 rounded w-80"
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border px-4 py-2 mb-4 rounded w-80"
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
