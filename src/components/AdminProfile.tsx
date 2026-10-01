import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Save, User, Phone, Mail, MapPin, Shield } from 'lucide-react';

export default function AdminProfile() {
  const { state, dispatch } = useApp();
  const admin = state.employees.find(e => e.role === 'admin');
  
  const [formData, setFormData] = useState({
    name: admin?.name || '',
    phone: admin?.phone || '',
    email: admin?.email || '',
    address: admin?.address || '',
    telegramNick: admin?.telegramNick || '',
    position: admin?.position || '',
    monthlySalary: admin?.monthlySalary || 0,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_ADMIN_PROFILE', payload: formData });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Личный профиль</h2>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {formData.name.charAt(0) || 'А'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{formData.name || 'Администратор'}</h3>
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Shield className="w-4 h-4" />
                <span>Администратор</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4" />
                ФИО
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Shield className="w-4 h-4" />
                Должность
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Оклад (₽/мес)</label>
              <input
                type="number"
                value={formData.monthlySalary}
                onChange={e => setFormData({ ...formData, monthlySalary: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Контактная информация</h3>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4" />
                Телефон
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="admin@company.ru"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4" />
                Адрес
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="г. Москва, ул. Примерная, д. 1"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <span className="text-lg">💬</span>
                Telegram ник
              </label>
              <input
                type="text"
                value={formData.telegramNick}
                onChange={e => setFormData({ ...formData, telegramNick: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="@admin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800">
          <strong>Примечание:</strong> Вы не можете редактировать свой профиль из вкладки "Сотрудники". 
          Все изменения вносятся только через эту страницу.
        </p>
      </div>
    </div>
  );
}
