import { NavLink } from "react-router";

const navigation = [
  {
    label: "Hem",
    to: "/",
  },
  {
    label: "Produkter",
    to: "/products",
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
            P3D
          </div>

          <div>
            <p className="font-bold leading-none text-slate-950">Priamos</p>

            <p className="mt-1 text-xs font-medium tracking-widest text-slate-500">
              3D LAB
            </p>
          </div>
        </NavLink>

        <nav
          aria-label="Huvudnavigation"
          className="flex items-center gap-2 sm:gap-6"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive
                  ? "hidden font-semibold text-slate-950 sm:block"
                  : "hidden text-slate-500 transition hover:text-slate-950 sm:block"
              }
            >
              {item.label}
            </NavLink>
          ))}

          <NavLink
            to="/cart"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Varukorg
          </NavLink>

          <NavLink
            to="/login"
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Logga in
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
