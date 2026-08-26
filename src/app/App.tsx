import { Route, Routes } from "react-router";

import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";

import AdminPage from "../pages/AdminPage";
import AdminProductsPage from "../pages/AdminProductsPage";
import AdminSupportPage from "../pages/AdminSupportPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import ContactPage from "../pages/ContactPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProductDetailsPage from "../pages/ProductDetailsPage";
import ProductsPage from "../pages/ProductsPage";

import ProtectedAdminRoute from "../routes/ProtectedAdminRoute";

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <div className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/products" element={<ProductsPage />} />

          <Route path="/products/:id" element={<ProductDetailsPage />} />

          <Route path="/cart" element={<CartPage />} />

          <Route path="/checkout" element={<CheckoutPage />} />

          <Route path="/contact" element={<ContactPage />} />

          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminPage />
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/admin/products"
            element={
              <ProtectedAdminRoute>
                <AdminProductsPage />
              </ProtectedAdminRoute>
            }
          />

          <Route
            path="/admin/support"
            element={
              <ProtectedAdminRoute>
                <AdminSupportPage />
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}

export default App;
