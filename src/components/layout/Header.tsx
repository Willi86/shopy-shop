import { NavLink, useNavigate } from "react-router";

import { useAuth } from "../../features/auth/useAuth";
import { useCart } from "../../features/cart/useCart";

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
  const navigate = useNavigate();

  const { totalItems } = useCart();

  const { user, role, isLoading, isLoggedIn, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();

      navigate("/");
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <NavLink
          to="/"
          className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        >
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
          className="flex items-center gap-2 sm:gap-5"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive
                  ? "hidden rounded font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 sm:block"
                  : "hidden rounded text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 sm:block"
              }
            >
              {item.label}
            </NavLink>
          ))}

          {isLoggedIn && role === "admin" && (
            <NavLink
              to="/admin"
              className="hidden rounded text-sm font-semibold text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 md:block"
            >
              Admin
            </NavLink>
          )}

          <NavLink
            to="/cart"
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            Varukorg
            {totalItems > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 text-xs text-white">
                {totalItems}
              </span>
            )}
          </NavLink>

          {!isLoading && !isLoggedIn && (
            <NavLink
              to="/login"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              Logga in
            </NavLink>
          )}

          {!isLoading && isLoggedIn && user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right lg:block">
                <p className="max-w-52 truncate text-sm font-semibold text-slate-950">
                  {user.email}
                </p>

                <p className="text-xs capitalize text-slate-500">
                  {role ?? "user"}
                </p>
              </div>

              <div
                title={user.email ?? "Användare"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold uppercase text-white"
              >
                {user.email?.charAt(0).toUpperCase() ?? "U"}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-[background-color,transform] hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              >
                Logga ut
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
