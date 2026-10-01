import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Employee } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Edit2, Trash2, X, Save, User } from 'lucide-react';

export default function EmployeeList() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    pin: '',
    telegramNick: '',
    telegramChatId: '',
    position: '',
    payType: 'hourly',
    hourlyRate: 0,
    monthlySalary: 0,
    bonus: 0,
    hireDate: new Date().toISOString().split('T')[0],
  });

  const employees = state.employees.filter(e => e.role !== 'admin');

  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      pin: '',
      telegramNick: '',
      telegramChatId: '',
      position: '',
      payType: 'hourly',
      hourlyRate: 0,
      monthlySalary: 0,
      bonus: 0,
      hireDate: new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      pin: emp.pin,
      telegramNick: emp.telegramNick,
      telegramChatId: emp.telegramChatId,
      position: emp.position,
      payType: emp.payType,
      hourlyRate: emp.hourlyRate,
      monthlySalary: emp.monthlySalary,
      bonus: emp.bonus,
      hireDate: emp.hireDate,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.pin) return;

    if (editingEmployee) {
      dispatch({
        type: 'UPDATE_EMPLOYEE',
        payload: { ...editingEmployee, ...formData } as Employee,
      });
    } else {
      const newEmployee: Employee = {
        id: uuidv4(),
        name: formData.name || '',
        pin: formData.pin || '',
        role: 'employee',
        telegramNick: formData.telegramNick || '',
        telegramChatId: formData.telegramChatId || '',
        position: formData.position || '',
        payType: formData.payType || 'hourly',
        hourlyRate: formData.hourlyRate || 0,
        monthlySalary: formData.monthlySalary || 0,
        bonus: formData.bonus || 0,
        fines: [],
        hireDate: formData.hireDate || new Date().toISOString().split('T')[0],
        isActive: true,
      };
      dispatch({ type: 'ADD_EMPLOYEE', payload: newEmployee });
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить сотрудника?')) {
      dispatch({ type: 'DELETE_EMPLOYEE', payload: id });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Сотрудники</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* Employee Cards */}
      <div className="grid gap-4">
        {employees.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Нет сотрудников</p>
            <p className="text-gray-400 text-sm">Добавьте первого сотрудника</p>
          </div>
        )}
        {employees.map(emp => (
          <div key={emp.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">
                    {emp.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                  <p className="text-sm text-gray-500">{emp.position}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-gray-400">
                      TG: {emp.telegramNick || '—'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {emp.payType === 'hourly'
                        ? `${emp.hourlyRate} ₽/час`
                        : `${emp.monthlySalary} ₽/мес`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(emp)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">
                  {editingEmployee ? 'Редактировать' : 'Новый сотрудник'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN-код *</label>
                  <input
                    type="text"
                    value={formData.pin || ''}
                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telegram ник</label>
                  <input
                    type="text"
                    value={formData.telegramNick || ''}
                    onChange={e => setFormData({ ...formData, telegramNick: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="@username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telegram Chat ID *
                  </label>
                  <input
                    type="text"
                    value={formData.telegramChatId || ''}
                    onChange={e => setFormData({ ...formData, telegramChatId: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123456789"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Узнать ID: напишите боту @userinfobot
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
                  <input
                    type="text"
                    value={formData.position || ''}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Менеджер"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип оплаты</label>
                  <select
                    value={formData.payType || 'hourly'}
                    onChange={e => setFormData({ ...formData, payType: e.target.value as 'hourly' | 'salary' })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="hourly">Почасовая</option>
                    <option value="salary">Оклад</option>
                  </select>
                </div>

                {formData.payType === 'hourly' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ставка (₽/час)</label>
                    <input
                      type="number"
                      value={formData.hourlyRate || ''}
                      onChange={e => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="300"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Оклад (₽/мес)</label>
                    <input
                      type="number"
                      value={formData.monthlySalary || ''}
                      onChange={e => setFormData({ ...formData, monthlySalary: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="50000"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Премия (₽)</label>
                  <input
                    type="number"
                    value={formData.bonus || ''}
                    onChange={e => setFormData({ ...formData, bonus: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата принятия</label>
                  <input
                    type="date"
                    value={formData.hireDate || ''}
                    onChange={e => setFormData({ ...formData, hireDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
