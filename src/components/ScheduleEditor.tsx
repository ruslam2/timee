import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ScheduleEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Calendar, ChevronLeft, ChevronRight, Save, Bell, Clock } from 'lucide-react';
import { getStatusColor, getStatusLabel, getScheduleStatus } from '../utils/salary';
import { notifyScheduleChange, notifyDayStart, notifyDayEnd } from '../utils/telegram';

export default function ScheduleEditor() {
  const { state, dispatch } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingCell, setEditingCell] = useState<{ empId: string; date: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editField, setEditField] = useState<'start' | 'end' | 'actualStart' | 'actualEnd'>('start');

  const employees = state.employees.filter(e => e.isActive);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return date.toISOString().split('T')[0];
    });
  }, [year, month, daysInMonth]);

  const getSchedule = (empId: string, date: string): ScheduleEntry | undefined => {
    return state.schedules.find(s => s.employeeId === empId && s.date === date);
  };

  const handleCellClick = (empId: string, date: string, field: 'start' | 'end' | 'actualStart' | 'actualEnd') => {
    const schedule = getSchedule(empId, date);
    setEditingCell({ empId, date });
    setEditField(field);
    if (schedule) {
      setEditValue((schedule as any)[field] || '');
    } else {
      setEditValue(field === 'start' || field === 'actualStart' ? '09:00' : '18:00');
    }
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    
    const { empId, date } = editingCell;
    const existing = getSchedule(empId, date);
    
    let updated: ScheduleEntry;
    if (existing) {
      updated = { ...existing, [editField as string]: editValue } as ScheduleEntry;
    } else {
      updated = {
        id: uuidv4(),
        employeeId: empId,
        date,
        startTime: editField === 'start' ? editValue : '09:00',
        endTime: editField === 'end' ? editValue : '18:00',
        actualStart: editField === 'actualStart' ? editValue : undefined,
        actualEnd: editField === 'actualEnd' ? editValue : undefined,
        status: 'scheduled',
      };
    }
    
    updated.status = getScheduleStatus(updated) as ScheduleEntry['status'];
    
    if (existing) {
      dispatch({ type: 'UPDATE_SCHEDULE', payload: updated });
    } else {
      dispatch({ type: 'ADD_SCHEDULE', payload: updated });
    }
    
    setEditingCell(null);
  };

  const handleFillMonth = (empId: string) => {
    const newSchedules = [...state.schedules.filter(s => s.employeeId !== empId || 
      !(new Date(s.date).getMonth() === month && new Date(s.date).getFullYear() === year))];
    
    days.forEach(date => {
      const dayOfWeek = new Date(date).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends
      
      newSchedules.push({
        id: uuidv4(),
        employeeId: empId,
        date,
        startTime: state.settings.workDayStart,
        endTime: state.settings.workDayEnd,
        status: 'scheduled',
      });
    });
    
    dispatch({ type: 'SET_SCHEDULES', payload: newSchedules });
  };

  const handleNotifyAll = async () => {
    const monthSchedules = state.schedules.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    
    const startDate = days[0];
    const endDate = days[days.length - 1];
    
    // Подсчёт сотрудников с Chat ID
    const affectedIds = new Set(monthSchedules.map(s => s.employeeId));
    const affectedEmployees = employees.filter(e => affectedIds.has(e.id) && e.role !== 'admin');
    const withChatId = affectedEmployees.filter(e => e.telegramChatId);
    const withoutChatId = affectedEmployees.filter(e => !e.telegramChatId);
    
    if (!state.settings.telegramBotToken) {
      alert('⚠️ Не указан токен Telegram бота в настройках!');
      return;
    }
    
    if (withChatId.length === 0) {
      alert('⚠️ Ни у одного сотрудника не указан Telegram Chat ID!\n\nУзнать ID можно написав боту @userinfobot');
      return;
    }
    
    await notifyScheduleChange(employees, monthSchedules, startDate, endDate, state.settings);
    
    let message = `✅ Уведомления отправлены!\n\nОтправлено: ${withChatId.length} сотр.`;
    if (withoutChatId.length > 0) {
      message += `\nПропущено (нет ID): ${withoutChatId.length}\n\n${withoutChatId.map(e => `• ${e.name}`).join('\n')}`;
    }
    alert(message);
  };

  const handleNotifyDay = async (type: 'start' | 'end', date: string) => {
    const daySchedules = state.schedules.filter(s => s.date === date);
    if (type === 'start') {
      await notifyDayStart(employees, daySchedules, date, state.settings);
    } else {
      await notifyDayEnd(employees, daySchedules, date, state.settings);
    }
    alert(`Уведомление о ${type === 'start' ? 'начале' : 'конце'} дня отправлено!`);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Расписание</h2>
        <div className="flex gap-2">
          <button
            onClick={handleNotifyAll}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Bell className="w-4 h-4" />
            Уведомить всех
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-3 border">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-lg">{monthNames[month]} {year}</h3>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Во время</span>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Раньше ≤15мин</span>
        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Опоздание ≥15мин</span>
        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">Ушёл раньше</span>
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Ушёл позже</span>
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Запланировано</span>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 min-w-[150px]">
                Сотрудник
              </th>
              {days.map(date => {
                const d = new Date(date);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={date}
                    className={`px-1 py-2 text-center font-medium min-w-[50px] ${
                      isWeekend ? 'text-red-400 bg-red-50/50' : 'text-gray-600'
                    }`}
                  >
                    <div>{d.getDate()}</div>
                    <div className="text-[10px]">{dayNames[d.getDay()]}</div>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center font-medium text-gray-600">Действия</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 border-r">
                  <div className="truncate max-w-[140px]">{emp.name}</div>
                  <div className="text-[10px] text-gray-400">{emp.position}</div>
                </td>
                {days.map(date => {
                  const schedule = getSchedule(emp.id, date);
                  const status = schedule ? getScheduleStatus(schedule) : 'none';
                  const statusColor = getStatusColor(status);
                  
                  return (
                    <td key={date} className="px-0.5 py-1 text-center">
                      {schedule ? (
                        <div
                          className={`px-1 py-0.5 rounded cursor-pointer hover:ring-2 hover:ring-blue-300 ${statusColor}`}
                          onClick={() => handleCellClick(emp.id, date, 'start')}
                          title={`${schedule.startTime}-${schedule.endTime}${schedule.actualStart ? `\nФакт: ${schedule.actualStart}-${schedule.actualEnd}` : ''}`}
                        >
                          <div className="font-medium">{schedule.startTime}</div>
                          <div className="text-[9px]">{schedule.endTime}</div>
                          {schedule.actualStart && (
                            <div className="text-[9px] border-t mt-0.5 pt-0.5">
                              {schedule.actualStart}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="px-1 py-1 rounded cursor-pointer hover:bg-blue-50 text-gray-300 hover:text-blue-500"
                          onClick={() => handleCellClick(emp.id, date, 'start')}
                        >
                          +
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1">
                  <button
                    onClick={() => handleFillMonth(emp.id)}
                    className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] hover:bg-blue-100"
                  >
                    Заполнить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Редактировать смену</h3>
            <p className="text-sm text-gray-500 mb-4">
              {employees.find(e => e.id === editingCell.empId)?.name} — {editingCell.date}
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Начало (план)</label>
                <input
                  type="time"
                  value={editField === 'start' ? editValue : (getSchedule(editingCell.empId, editingCell.date)?.startTime || '09:00')}
                  onChange={e => { setEditField('start'); setEditValue(e.target.value); }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Конец (план)</label>
                <input
                  type="time"
                  value={editField === 'end' ? editValue : (getSchedule(editingCell.empId, editingCell.date)?.endTime || '18:00')}
                  onChange={e => { setEditField('end'); setEditValue(e.target.value); }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Фактическое начало</label>
                <input
                  type="time"
                  value={editField === 'actualStart' ? editValue : (getSchedule(editingCell.empId, editingCell.date)?.actualStart || '')}
                  onChange={e => { setEditField('actualStart'); setEditValue(e.target.value); }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Не указано"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Фактический конец</label>
                <input
                  type="time"
                  value={editField === 'actualEnd' ? editValue : (getSchedule(editingCell.empId, editingCell.date)?.actualEnd || '')}
                  onChange={e => { setEditField('actualEnd'); setEditValue(e.target.value); }}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Не указано"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingCell(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCellSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
