import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';

export default function FinesManager() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const employees = state.employees.filter(e => e.isActive && e.role !== 'admin');

  const handleAddFine = () => {
    if (!selectedEmployee || !amount || !reason) return;

    dispatch({
      type: 'ADD_FINE',
      payload: {
        employeeId: selectedEmployee,
        fine: {
          id: uuidv4(),
          date,
          amount: Number(amount),
          reason,
        },
      },
    });

    setSelectedEmployee('');
    setAmount('');
    setReason('');
    setDate(new Date().toISOString().split('T')[0]);
    setShowForm(false);
  };

  const handleRemoveFine = (employeeId: string, fineId: string) => {
    if (confirm('Удалить штраф?')) {
      dispatch({ type: 'REMOVE_FINE', payload: { employeeId, fineId } });
    }
  };

  const employeesWithFines = employees.filter(e => e.fines.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Штрафы</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить штраф
        </button>
      </div>

      {/* Fines List */}
      {employeesWithFines.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Нет штрафов</p>
          <p className="text-gray-400 text-sm">Штрафы вычитаются из зарплаты сотрудника</p>
        </div>
      ) : (
        <div className="space-y-4">
          {employeesWithFines.map(emp => (
            <div key={emp.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold">{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                    <p className="text-xs text-gray-500">
                      Общая сумма штрафов: {emp.fines.reduce((s, f) => s + f.amount, 0).toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {emp.fines.map(fine => (
                  <div
                    key={fine.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fine.reason}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(fine.date).toLocaleDateString('ru-RU')} • -{fine.amount.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFine(emp.id, fine.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Fine Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Новый штраф</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
                  <select
                    value={selectedEmployee}
                    onChange={e => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите сотрудника</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Причина</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Опоздание на работу"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddFine}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Добавить штраф
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
