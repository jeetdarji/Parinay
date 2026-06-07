import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

// Minimal on-brand login. Required because profiles RLS scopes data to
// auth.uid() — without a session, every dashboard query returns nothing.
export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error('Invalid credentials')
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="grid min-h-screen grid-cols-12 bg-[#F9F8F6]">
      {/* Left editorial panel (dark) */}
      <div className="relative col-span-12 hidden flex-col justify-between bg-[#1A1A1A] p-16 md:col-span-5 md:flex">
        <div className="flex items-center">
          <span className="mr-3 inline-block h-px w-8 bg-[#F9F8F6]/40" />
          <span className="font-inter text-[10px] uppercase tracking-[0.3em] text-[#EBE5DE]/70">
            The Date Crew
          </span>
        </div>
        <div>
          <h1 className="font-playfair text-5xl leading-[1.05] text-[#F9F8F6]">
            No app.
            <br />
            No swiping.
            <br />
            <span className="italic text-[#D4AF37]">Just matchmakers.</span>
          </h1>
          <p className="mt-6 max-w-sm font-inter text-sm leading-relaxed text-[#EBE5DE]/70">
            The internal workspace for India&apos;s premium human-led
            matchmaking service.
          </p>
        </div>
        <span className="font-inter text-[10px] uppercase tracking-[0.25em] text-[#EBE5DE]/50">
          Matchmaker Access Only
        </span>
      </div>

      {/* Right form panel */}
      <div className="col-span-12 flex items-center justify-center px-8 md:col-span-7 md:px-16">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <p className="font-inter text-[10px] uppercase tracking-[0.3em] text-[#6C6863]">
            Welcome back
          </p>
          <h2 className="mt-3 font-playfair text-3xl text-[#1A1A1A]">
            Sign in to continue
          </h2>
          <div className="mt-10 flex flex-col gap-8">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="editorial-placeholder h-12 border-b border-[#1A1A1A] bg-transparent px-0 font-inter text-sm text-[#1A1A1A] outline-none transition-colors duration-300 focus:border-[#D4AF37]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="editorial-placeholder h-12 border-b border-[#1A1A1A] bg-transparent px-0 font-inter text-sm text-[#1A1A1A] outline-none transition-colors duration-300 focus:border-[#D4AF37]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`group relative mt-10 h-12 w-full overflow-hidden bg-[#1A1A1A] font-inter text-[10px] uppercase tracking-[0.2em] text-[#F9F8F6] ${
              loading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <span className="absolute inset-0 -translate-x-full bg-[#D4AF37] transition-transform duration-500 ease-out group-hover:translate-x-0" />
            <span className="relative z-10">
              {loading ? 'Signing in...' : 'Sign In'}
            </span>
          </button>
        </motion.form>
      </div>
    </div>
  )
}
