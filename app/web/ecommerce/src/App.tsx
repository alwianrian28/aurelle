const Information = lazy(() => import('./pages/Information'));
const Help = lazy(() => import('./pages/Help'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const OurStory = lazy(() => import('./pages/OurStory'));
const Contact = lazy(() => import('./pages/Contact'));
const Recovery = lazy(() => import('./pages/auth/Recovery'));
const SystemPage = lazy(() => import('./pages/SystemPage'));
const AccountNotifications = lazy(() => import('./pages/account/AccountNotifications'));
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

/** DEV-ONLY: studio render untuk membuat gambar produk sementara (dibuang dari build produksi). */
const RenderStudio = import.meta.env.DEV ? lazy(() => import('./dev/RenderStudio')) : null;
import Layout from './components/Layout';
const Entrance = lazy(() => import('./pages/Entrance'));
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Collections = lazy(() => import('./pages/Collections'));
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));
import RequireAuth from './components/RequireAuth';
const Checkout = lazy(() => import('./pages/checkout/Checkout'));
const Payment = lazy(() => import('./pages/checkout/Payment'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const AccountOverview = lazy(() => import('./pages/account/AccountOverview'));
const AccountOrders = lazy(() => import('./pages/account/AccountOrders'));
const OrderDetail = lazy(() => import('./pages/account/OrderDetail'));
const AccountWishlist = lazy(() => import('./pages/account/AccountWishlist'));
const AccountAddresses = lazy(() => import('./pages/account/AccountAddresses'));
const AccountProfile = lazy(() => import('./pages/account/AccountProfile'));

/**
 * Router publik — struktur mengikuti sitemap PRD §5.1 dengan prefiks bahasa /:lang.
 * Seluruh rute publik MVP sudah memiliki halaman; data masih mock sampai backend Express tersedia.
 */
function LegacyLocaleRedirect() {
  const location = useLocation();
  const pathname = location.pathname.replace(/^\/(id|en|eng)(?=\/|$)/, "") || "/";
  return <Navigate to={pathname + location.search + location.hash} replace />;
}

function App() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh', background: '#0E1116' }} />}><Routes>
      <Route path="/" element={<Suspense fallback={null}><Entrance /></Suspense>} />
      {RenderStudio && <Route path="/__render" element={<Suspense fallback={null}><RenderStudio /></Suspense>} />}
      {["id", "en", "eng"].map(locale => <Route key={locale} path={`/${locale}/*`} element={<LegacyLocaleRedirect />} />)}
      {/* Auth pages are full-screen: no site header or footer. */}
      <Route path="auth/login" element={<Login />} />
      <Route path="auth/register" element={<Register />} />
      <Route path="auth/verify-email" element={<Recovery mode="verify" />} />
      <Route path="auth/forgot-password" element={<Recovery mode="forgot" />} />
      <Route path="auth/reset-password" element={<Recovery mode="reset" />} />
      <Route element={<Layout />}>
        <Route path="store" element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:slug" element={<ProductDetail />} />
        <Route path="collections" element={<Collections />} />
        <Route path="collections/:slug" element={<CollectionDetail />} />
        <Route path="our-story" element={<OurStory />} />
        <Route path="contact" element={<Contact />} />
        <Route path="track-order" element={<TrackOrder />} />
        <Route path="faq" element={<Help kind="faq" />} />
        <Route path="policies/:slug" element={<Help kind="policy" />} />
        <Route path="guides/:slug" element={<Information />} />
        <Route path="search" element={<Shop />} />
        <Route path="cart" element={<Cart />} />
        <Route
          path="checkout"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        <Route
          path="checkout/payment/:orderId"
          element={
            <RequireAuth>
              <Payment />
            </RequireAuth>
          }
        />
        <Route path="error" element={<SystemPage kind="error" />} />
        <Route path="maintenance" element={<SystemPage kind="maintenance" />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AccountOverview />} />
          <Route path="notifications" element={<AccountNotifications />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="orders/:orderId" element={<OrderDetail />} />
          <Route path="wishlist" element={<AccountWishlist />} />
          <Route path="addresses" element={<AccountAddresses />} />
          <Route path="profile" element={<AccountProfile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
  );
}

export default App;
