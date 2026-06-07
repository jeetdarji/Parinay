import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F8F6] px-8 text-center">
      <p className="font-playfair text-6xl italic text-[#1A1A1A]">404</p>
      <p className="mt-4 font-inter text-xs uppercase tracking-[0.25em] text-[#6C6863]">
        This page does not exist
      </p>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mt-8 h-12 border border-[#1A1A1A] px-8 font-inter text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A] transition-colors duration-500 hover:bg-[#1A1A1A] hover:text-[#F9F8F6]"
      >
        Back to Dashboard
      </button>
    </div>
  )
}
