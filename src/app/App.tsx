import { Route, Routes } from "react-router";

import Header from "../components/layout/Header";
import AdminPage from "../pages/AdminPage";
import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProductDetailsPage from "../pages/ProductDetailsPage";
import ProductsPage from "../pages/ProductsPage";
import ProtectedAdminRoute from "../routes/ProtectedAdminRoute";

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/products" element={<ProductsPage />} />

        <Route path="/products/:id" element={<ProductDetailsPage />} />

        <Route path="/cart" element={<CartPage />} />

        <Route path="/checkout" element={<CheckoutPage />} />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPage />
            </ProtectedAdminRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
