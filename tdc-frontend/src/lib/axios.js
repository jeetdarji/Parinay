// Axios instance for the Python FastAPI backend (matching + AI endpoints).
// Injects the Supabase JWT so the backend could verify identity if needed.
import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
