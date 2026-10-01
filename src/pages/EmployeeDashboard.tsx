import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Clock, DollarSign, Calendar, TrendingUp, AlertCircle, Play, Square } from 'lucide-react';
import { getEffectiveHours, calculateFullMonth, calculateAdvance, calculateSalary, getStatusColor, getStatusLabel, getScheduleStatus, formatHours } from '../utils/salary';

export default function EmployeeDashboard() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'results' | 'earnings'>('results');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const user = state.currentUser!;
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toTimeString().slice(0, 5);

  // Найти сегодняшнюю смену
  const todaySchedule = useMemo(() => {
    return state.schedules.find(s => s.employeeId === user.id && s.date === today);
  }, [state.schedules, user.id, today]);

  // Статус текущей смены
  const shiftStatus = useMemo(() => {
    if (!todaySchedule) return 'no-schedule';
    if (!todaySchedule.actualStart) return 'not-started';
    if (!todaySchedule.actualEnd) return 'in-progress';
    return 'completed';
  }, [todaySchedule]);

  const userSchedules = useMemo(() => {
    return state.schedules
      .filter(s => s.employeeId === user.id)
      .filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.schedules, user.id, selectedMonth, selectedYear]);

  const monthData = useMemo(() => {
    return calculateFullMonth(user, state.schedules, selectedMonth, selectedYear);
  }, [user, state.schedules, selectedMonth, selectedYear]);

  const advance = useMemo(() => {
    return calculateAdvance(user, state.schedules, selectedMonth, selectedYear, state.settings);
  }, [user, state.schedules, selectedMonth, selectedYear, state.settings]);

  const salary = useMemo(() => {
    return calculateSalary(user, state.schedules, selectedMonth, selectedYear, state.settings);
  }, [user, state.schedules, selectedMonth, selectedYear, state.settings]);

  // Открытие смены
  const handleStartShift = () => {
    if (!todaySchedule) {
      alert('На сегодня нет запланированной смены');
      return;
    }
    
    const updated = {
      ...todaySchedule,
      actualStart: currentTime,
    };
    updated.status = getScheduleStatus(updated) as any;
    
    dispatch({ type: 'UPDATE_SCHEDULE', payload: updated });
  };

  // Закрытие смены
  const handleEndShift = () => {
    if (!todaySchedule) return;
    
    const updated = {
      ...todaySchedule,
      actualEnd: currentTime,
    };
    updated.status = getScheduleStatus(updated) as any;
    
    dispatch({ type: 'UPDATE_SCHEDULE', payload: updated });
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const totalShifts = userSchedules.length;
  const totalHours = monthData.totalHours;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">{user.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{user.name}</h1>
              <p className="text-xs text-gray-500">{user.position}</p>
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

      {/* Shift Control Panel */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className={`rounded-xl border p-4 ${
          shiftStatus === 'in-progress' 
            ? 'bg-green-50 border-green-200' 
            : shiftStatus === 'completed'
            ? 'bg-gray-50 border-gray-200'
            : shiftStatus === 'not-started'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {shiftStatus === 'in-progress' && '🟢 Смена идёт'}
                {shiftStatus === 'completed' && '✅ Смена завершена'}
                {shiftStatus === 'not-started' && '🔵 Смена не начата'}
                {shiftStatus === 'no-schedule' && '⚠️ Нет смены на сегодня'}
              </h3>
              {todaySchedule && (
                <p className="text-sm text-gray-600 mt-1">
                  План: {todaySchedule.startTime} — {todaySchedule.endTime}
                  {todaySchedule.actualStart && (
                    <span className="ml-2">
                      | Факт начало: {todaySchedule.actualStart}
                      {todaySchedule.actualEnd && ` — ${todaySchedule.actualEnd}`}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              {shiftStatus === 'not-started' && (
                <button
                  onClick={handleStartShift}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30"
                >
                  <Play className="w-4 h-4" />
                  Начать смену
                </button>
              )}
              {shiftStatus === 'in-progress' && (
                <button
                  onClick={handleEndShift}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
                >
                  <Square className="w-4 h-4" />
                  Завершить смену
                </button>
              )}
              {shiftStatus === 'completed' && (
                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  Завершена ✓
                </span>
              )}
              {shiftStatus === 'no-schedule' && (
                <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
                  Выходной
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Month Selector */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 bg-white rounded-xl p-3 border">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm flex-1"
          >
            {monthNames.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Смен</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{totalShifts}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Часов</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatHours(totalHours)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500">Начислено</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{monthData.totalEarnings.toLocaleString('ru-RU')} ₽</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">К выплате</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{monthData.netPay.toLocaleString('ru-RU')} ₽</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'results'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Итоги работы
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'earnings'
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            💰 Начисления
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Итоги работы за {monthNames[selectedMonth]} {selectedYear}</h3>
            </div>
            
            {userSchedules.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>Нет записей за этот период</p>
              </div>
            ) : (
              <div className="divide-y">
                {userSchedules.map(schedule => {
                  const status = getScheduleStatus(schedule);
                  const effectiveHours = getEffectiveHours(schedule);
                  
                  return (
                    <div key={schedule.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(schedule.date).toLocaleDateString('ru-RU', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">
                              План: {schedule.startTime} — {schedule.endTime}
                            </span>
                            {schedule.actualStart && (
                              <span className="text-sm text-gray-400">
                                | Факт: {schedule.actualStart} — {schedule.actualEnd || '...'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                          <p className="text-sm font-medium text-gray-700 mt-1">
                            {formatHours(effectiveHours)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            <div className="p-4 bg-gray-50 border-t">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Всего смен</p>
                  <p className="font-bold text-gray-900">{totalShifts}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Всего часов</p>
                  <p className="font-bold text-gray-900">{formatHours(totalHours)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ср. часов/смена</p>
                  <p className="font-bold text-gray-900">
                    {totalShifts > 0 ? formatHours(totalHours / totalShifts) : '0ч'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-4">
            {/* Earnings Breakdown */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">Начисления за {monthNames[selectedMonth]} {selectedYear}</h3>
              </div>
              
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-sm">💵</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Основное начисление</p>
                      <p className="text-xs text-gray-500">
                        {user.payType === 'salary'
                          ? `Оклад ${user.monthlySalary.toLocaleString('ru-RU')} ₽`
                          : `${formatHours(totalHours)} × ${user.hourlyRate} ₽/ч`}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">{monthData.totalEarnings.toLocaleString('ru-RU')} ₽</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 text-sm">🎁</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Премия</p>
                      <p className="text-xs text-gray-500">Учитывается в зарплате</p>
                    </div>
                  </div>
                  <span className="font-bold text-green-600">+{user.bonus.toLocaleString('ru-RU')} ₽</span>
                </div>

                {monthData.totalFines > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Штрафы</p>
                        <p className="text-xs text-gray-500">Вычитаются из зарплаты</p>
                      </div>
                    </div>
                    <span className="font-bold text-red-600">-{monthData.totalFines.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="p-4 bg-emerald-50 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Итого к выплате</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {monthData.netPay.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* Advance & Salary Split */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-amber-600 text-sm">📅</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Аванс</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  1 — {state.settings.advanceDay} число
                </p>
                <p className="text-xl font-bold text-amber-600">
                  {Math.round(advance).toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {user.payType === 'salary' ? '40% от оклада' : 'По фактическим часам'}
                </p>
              </div>

              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <span className="text-emerald-600 text-sm">💰</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Зарплата</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {state.settings.advanceDay + 1} — конец месяца
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  {Math.round(salary).toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {user.payType === 'salary' ? '60% + премия - штрафы' : 'Часы × ставка + премия - штрафы'}
                </p>
              </div>
            </div>

            {/* Fines Detail */}
            {user.fines.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900">Детализация штрафов</h3>
                </div>
                <div className="divide-y">
                  {user.fines.map(fine => (
                    <div key={fine.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{fine.reason}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(fine.date).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-600">
                        -{fine.amount.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
