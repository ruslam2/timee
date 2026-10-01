import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

function AppContent() {
  const { state } = useApp();

  if (!state.currentUser) {
    return <LoginPage />;
  }

  if (state.currentUser.role === 'admin') {
    return <AdminDashboard />;
  }

  return <EmployeeDashboard />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
