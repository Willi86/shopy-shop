import { NavLink } from 'react-router'

const navigation = [
  {
    label: 'Hem',
    to: '/',
  },
  {
    label: 'Produkter',
    to: '/products',
  },
  {
    label: 'Varukorg',
    to: '/cart',
  },
]

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <NavLink
          to="/"
          className="text-xl font-bold tracking-tight text-slate-950"
        >
          Min Butik
        </NavLink>

        <nav
          aria-label="Huvudnavigation"
          className="flex items-center gap-6"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive
                  ? 'font-semibold text-slate-950'
                  : 'text-slate-500 transition hover:text-slate-950'
              }
            >
              {item.label}
            </NavLink>
          ))}

          <NavLink
            to="/login"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Logga in
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Header