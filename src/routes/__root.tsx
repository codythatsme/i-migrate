import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import '../index.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-semibold tracking-tight text-white">
              i-migrate
            </Link>
            <div className="flex items-center gap-1">
              <NavLink to="/environments">Environments</NavLink>
              <NavLink to="/browse">Browse</NavLink>
              <NavLink to="/mappings">Mappings</NavLink>
              <NavLink to="/jobs">Jobs</NavLink>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800 [&.active]:text-white [&.active]:bg-zinc-800"
    >
      {children}
    </Link>
  )
}

