'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { auth, db } from '@/lib/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, setDoc, getDocs } from 'firebase/firestore'
import TabNavigation from '@/components/TabNavigation'
import useRoleGuard from '@/hooks/useRoleGuard'

interface User {
  uid: string
  email: string
  name: string
  itkooId: string
  role: 'admin' | 'driver'
}

export default function Tab7() {
  useRoleGuard('admin')

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    itkooId: '',
    role: 'driver' as 'admin' | 'driver',
  })

  const [message, setMessage] = useState('')
  const [userList, setUserList] = useState<User[]>([])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    const { email, password, name, itkooId, role } = form
    if (!email || !password || !name || !itkooId || !role) {
      alert('❗ 모든 항목을 입력해주세요.')
      return
    }
    if (password.length < 6) {
      alert('❗ 비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const uid = userCredential.user.uid

      await setDoc(doc(db, 'Users', uid), {
        uid,
        email,
        name,
        itkooId,
        role
      })

      setMessage(`✅ 등록 완료: ${email} (${uid})`)
      setForm({ email: '', password: '', name: '', itkooId: '', role: 'driver' })
      await loadUsers()
    } catch (err) {
      if (err instanceof Error) {
        console.error(err)
        setMessage(`❌ 등록 실패: ${err.message}`)
      }
    }
  }

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, 'Users'))
    const list = snap.docs.map(doc => doc.data() as User)
    setUserList(list)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <div>
      <TabNavigation />
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-indigo-700">👤 기사 등록 (tab7)</h1>

        <div className="space-y-4 bg-white shadow p-6 rounded-lg border border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700">이메일</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">비밀번호</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">이름</label>
            <input name="name" type="text" value={form.name} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">잇쿠 ID</label>
            <input name="itkooId" type="text" value={form.itkooId} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">역할</label>
            <select name="role" value={form.role} onChange={handleChange} className="border rounded px-3 py-2 w-full">
              <option value="driver">driver</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded w-full"
          >
            등록하기
          </button>

          {message && (
            <p className="mt-4 text-sm text-center font-medium text-green-600 whitespace-pre-wrap">
              {message}
            </p>
          )}
        </div>

        <hr className="my-8" />

        <h2 className="text-xl font-bold mb-3 text-gray-800">📋 등록된 사용자 목록</h2>
        {userList.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 사용자가 없습니다.</p>
        ) : (
          <table className="w-full text-sm border shadow-sm rounded overflow-hidden">
            <thead>
              <tr className="bg-gray-100 text-center">
                <th className="border p-2">이름</th>
                <th className="border p-2">이메일</th>
                <th className="border p-2">itkooId</th>
                <th className="border p-2">역할</th>
                <th className="border p-2">UID</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u, i) => (
                <tr key={i} className="text-center">
                  <td className="border p-1">{u.name}</td>
                  <td className="border p-1">{u.email}</td>
                  <td className="border p-1">{u.itkooId}</td>
                  <td className="border p-1">{u.role}</td>
                  <td className="border p-1 text-xs text-gray-400">{u.uid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
