import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Calendar, FileText, Settings, UserCircle, LogOut, DollarSign, AlertTriangle } from 'lucide-react';
import EmployeeList from '../components/EmployeeList';
import ScheduleEditor from '../components/ScheduleEditor';
import Reports from '../components/Reports';
import AdminSettings from '../components/AdminSettings';
import AdminProfile from '../components/AdminProfile';
import FinesManager from '../components/FinesManager';

type Tab = 'employees' | 'schedule' | 'reports' | 'fines' | 'settings' | 'profile';

export default function AdminDashboard() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('employees');

  const tabs = [
    { id: 'profile' as Tab, label: 'Профиль', icon: UserCircle },
    { id: 'employees' as Tab, label: 'Сотрудники', icon: Users },
    { id: 'schedule' as Tab, label: 'Расписание', icon: Calendar },
    { id: 'fines' as Tab, label: 'Штрафы', icon: AlertTriangle },
    { id: 'reports' as Tab, label: 'Отчёты', icon: FileText },
    { id: 'settings' as Tab, label: 'Настройки', icon: Settings },
  ];

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">А</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Панель администратора</h1>
              <p className="text-xs text-gray-500">{state.currentUser?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Выйти</span>
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'profile' && <AdminProfile />}
        {activeTab === 'employees' && <EmployeeList />}
        {activeTab === 'schedule' && <ScheduleEditor />}
        {activeTab === 'fines' && <FinesManager />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
}
