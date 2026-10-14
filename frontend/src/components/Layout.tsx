import { NavLink, Outlet } from "react-router-dom";
import { useLogout, useMe } from "../auth";
import { useCart } from "../cart";
import { useI18n } from "../i18n";

export default function Layout() {
  const { t, lang, setLang } = useI18n();
  const { data: me } = useMe();
  const { lines } = useCart();
  const logout = useLogout();
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <header className="header">
        <div className="container header-row">
          <NavLink to="/" className="logo">
            Magazin
          </NavLink>
          <nav className="nav">
            <NavLink to="/">{t("catalog")}</NavLink>
            <NavLink to="/cart">
              {t("cart")}
              {count > 0 && <span className="badge">{count}</span>}
            </NavLink>
            {me && <NavLink to="/orders">{t("orders")}</NavLink>}
            {me && <NavLink to="/cargo">{t("cargo")}</NavLink>}
            {me?.is_admin && <NavLink to="/admin">{t("admin")}</NavLink>}
          </nav>
          <div className="header-right">
            <button className="link" onClick={() => setLang(lang === "uz" ? "ru" : "uz")}>
              {lang === "uz" ? "RU" : "UZ"}
            </button>
            {me ? (
              <>
                <span className="muted">{me.phone}</span>
                <button className="link" onClick={logout}>
                  {t("logout")}
                </button>
              </>
            ) : (
              <NavLink to="/login">{t("login")}</NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
    </>
  );
}
