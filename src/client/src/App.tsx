import PageHeader from './components/PageHeader'
import AddressManager from './components/AddressManager'
import { useSearchParams, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import ReferralsPage from './components/Referrals/ReferralsPage'
import LoginPage from './components/Auth/LoginPage'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import { useAuth } from './utils/authContext'

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  
  // Get initial addresses from URL if available
  const getInitialAddresses = () => {
    const addressParam = searchParams.get('addresses');
    return addressParam ? addressParam.split(',') : [];
  };

  // Handle address list changes from AddressManager
  const handleAddressesChange = (newAddresses: string[]) => {
    // Update URL params when addresses change
    if (newAddresses.length > 0) {
      searchParams.set('addresses', newAddresses.join(','));
    } else {
      searchParams.delete('addresses');
    }
    setSearchParams(searchParams);
  };

  // Navigation links with active state
  const getNavLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-indigo-100 text-indigo-700'
        : 'text-gray-700 hover:bg-gray-100'
    }`;
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    // No need to navigate - ProtectedRoute will handle redirection
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="w-full mx-auto">
        {isAuthenticated && (
          <div className="flex justify-between items-center mb-8">
            <nav className="flex space-x-4 bg-white shadow-sm rounded-lg p-1">
              <Link 
                to="/" 
                className={getNavLinkClass('/')}
              >
                Flowrate Checker
              </Link>
              <Link 
                to="/referrals" 
                className={getNavLinkClass('/referrals')}
              >
                Referral Program
              </Link>
            </nav>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              Logout
            </button>
          </div>
        )}

        <Routes>
          {/* Public route - Login */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          } />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={
              <>
                <PageHeader 
                  title="Superfluid Flowrate Checker" 
                  subtitle="Check and compare SUP allocations for multiple addresses" 
                />
                <AddressManager 
                  initialAddresses={getInitialAddresses()}
                  onAddressesChange={handleAddressesChange}
                />
              </>
            } />
            <Route path="/referrals" element={<ReferralsPage />} />
          </Route>

          {/* Catch-all redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default App 