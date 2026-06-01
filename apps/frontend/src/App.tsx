import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContextProvider } from '@/components/ui/use-toast'
import Home from '@/pages/Home'
import DigestHistory from '@/pages/DigestHistory'
import { Rss, History } from 'lucide-react'
import { cn } from '@/lib/utils'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function getUserId(): string {
  const key = 'feedflow_user_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

const userId = getUserId()

function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white sm:relative sm:border-b sm:border-t-0">
      <div className="mx-auto flex max-w-4xl items-center justify-around px-4 py-2 sm:justify-start sm:gap-6 sm:py-3">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:text-sm',
              isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            )
          }
        >
          <Rss className="h-5 w-5" />
          <span>订阅管理</span>
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:text-sm',
              isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            )
          }
        >
          <History className="h-5 w-5" />
          <span>摘要历史</span>
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContextProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="flex-1 pb-16 sm:pb-0">
              <Routes>
                <Route path="/" element={<Home userId={userId} />} />
                <Route path="/history" element={<DigestHistory userId={userId} />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ToastContextProvider>
    </QueryClientProvider>
  )
}
