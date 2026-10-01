import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Calendar, DollarSign, Clock, AlertCircle } from 'lucide-react';
import {
  calculateAdvance,
  calculateSalary,
  calculateFullMonth,
  getEffectiveHours,
  formatDate,
} from '../utils/salary';

type ReportType = 'advance' | 'salary' | 'full';

export default function Reports() {
  const { state } = useApp();
  const [reportType, setReportType] = useState<ReportType>('full');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);

  const employees = state.employees.filter(e => e.isActive);
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const filteredSchedules = useMemo(() => {
    if (useCustomRange && customStart && customEnd) {
      return state.schedules.filter(s => s.date >= customStart && s.date <= customEnd);
    }
    return state.schedules.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [state.schedules, selectedMonth, selectedYear, useCustomRange, customStart, customEnd]);

  const reportData = useMemo(() => {
    return employees.map(emp => {
      const empSchedules = filteredSchedules.filter(s => s.employeeId === emp.id);
      const totalHours = empSchedules.reduce((sum, s) => sum + getEffectiveHours(s), 0);
      
      const totalFines = emp.fines
        .filter(f => {
          const d = new Date(f.date);
          if (useCustomRange && customStart && customEnd) {
            return f.date >= customStart && f.date <= customEnd;
          }
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        })
        .reduce((sum, f) => sum + f.amount, 0);

      let earnings = 0;
      let advance = 0;
      let salary = 0;

      if (useCustomRange) {
        if (emp.payType === 'salary') {
          earnings = emp.monthlySalary;
        } else {
          earnings = totalHours * emp.hourlyRate;
        }
      } else {
        advance = calculateAdvance(emp, state.schedules, selectedMonth, selectedYear, state.settings);
        salary = calculateSalary(emp, state.schedules, selectedMonth, selectedYear, state.settings);
        earnings = advance + salary;
      }

      const netPay = earnings + emp.bonus - totalFines;

      return {
        employee: emp,
        totalHours: Math.round(totalHours * 100) / 100,
        earnings: Math.round(earnings * 100) / 100,
        advance: Math.round(advance * 100) / 100,
        salary: Math.round(salary * 100) / 100,
        bonus: emp.bonus,
        fines: totalFines,
        netPay: Math.round(netPay * 100) / 100,
        schedules: empSchedules,
      };
    });
  }, [employees, filteredSchedules, state, selectedMonth, selectedYear, useCustomRange, customStart, customEnd]);

  const totalNetPay = reportData.reduce((sum, r) => sum + r.netPay, 0);
  const totalHours = reportData.reduce((sum, r) => sum + r.totalHours, 0);
  const totalFines = reportData.reduce((sum, r) => sum + r.fines, 0);

  const exportToExcel = () => {
    const data = reportData.map(r => ({
      'Сотрудник': r.employee.name,
      'Должность': r.employee.position,
      'Тип оплаты': r.employee.payType === 'hourly' ? 'Почасовая' : 'Оклад',
      'Ставка/Оклад': r.employee.payType === 'hourly' ? r.employee.hourlyRate : r.employee.monthlySalary,
      'Часы': r.totalHours,
      'Начислено': r.earnings,
      'Аванс': r.advance,
      'Зарплата': r.salary,
      'Премия': r.bonus,
      'Штрафы': r.fines,
      'Итого к выплате': r.netPay,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    
    const sheetName = useCustomRange
      ? `Отчёт ${customStart}-${customEnd}`
      : `Отчёт ${monthNames[selectedMonth]} ${selectedYear}`;
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${sheetName}.xlsx`);
  };

  const exportDetailedExcel = () => {
    const data: any[] = [];
    
    reportData.forEach(r => {
      r.schedules.forEach(s => {
        data.push({
          'Дата': formatDate(s.date),
          'Сотрудник': r.employee.name,
          'План начало': s.startTime,
          'План конец': s.endTime,
          'Факт начало': s.actualStart || '—',
          'Факт конец': s.actualEnd || '—',
          'Эффективные часы': Math.round(getEffectiveHours(s) * 100) / 100,
          'Статус': s.status,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Детализация');
    XLSX.writeFile(wb, `Детализация_${monthNames[selectedMonth]}_${selectedYear}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Отчёты по зарплате</h2>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={exportDetailedExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Детализация
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип отчёта</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="full">Полный за месяц</option>
              <option value="advance">Только аванс</option>
              <option value="salary">Только зарплата</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Месяц</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
              disabled={useCustomRange}
            >
              {monthNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Год</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
              disabled={useCustomRange}
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="customRange"
              checked={useCustomRange}
              onChange={e => setUseCustomRange(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="customRange" className="text-sm text-gray-700">
              Произвольный период
            </label>
          </div>

          {useCustomRange && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">С</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">По</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Итого к выплате</p>
              <p className="text-xl font-bold text-gray-900">{totalNetPay.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Всего часов</p>
              <p className="text-xl font-bold text-gray-900">{totalHours} ч</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Штрафы</p>
              <p className="text-xl font-bold text-gray-900">{totalFines.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Сотрудников</p>
              <p className="text-xl font-bold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Сотрудник</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Тип</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Часы</th>
                {(reportType === 'full' || reportType === 'advance') && (
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Аванс</th>
                )}
                {(reportType === 'full' || reportType === 'salary') && (
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Зарплата</th>
                )}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Премия</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Штрафы</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Итого</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(r => (
                <tr key={r.employee.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.employee.name}</div>
                    <div className="text-xs text-gray-500">{r.employee.position}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      r.employee.payType === 'salary'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.employee.payType === 'salary' ? 'Оклад' : 'Почасовая'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.totalHours}</td>
                  {(reportType === 'full' || reportType === 'advance') && (
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.advance.toLocaleString('ru-RU')} ₽
                    </td>
                  )}
                  {(reportType === 'full' || reportType === 'salary') && (
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.salary.toLocaleString('ru-RU')} ₽
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-green-600">
                    +{r.bonus.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    -{r.fines.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {r.netPay.toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td className="px-4 py-3 text-gray-900" colSpan={2}>ИТОГО</td>
                <td className="px-4 py-3 text-center text-gray-900">{totalHours}</td>
                {(reportType === 'full' || reportType === 'advance') && (
                  <td className="px-4 py-3 text-right text-gray-900">
                    {reportData.reduce((s, r) => s + r.advance, 0).toLocaleString('ru-RU')} ₽
                  </td>
                )}
                {(reportType === 'full' || reportType === 'salary') && (
                  <td className="px-4 py-3 text-right text-gray-900">
                    {reportData.reduce((s, r) => s + r.salary, 0).toLocaleString('ru-RU')} ₽
                  </td>
                )}
                <td className="px-4 py-3 text-right text-green-600">
                  +{reportData.reduce((s, r) => s + r.bonus, 0).toLocaleString('ru-RU')} ₽
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  -{totalFines.toLocaleString('ru-RU')} ₽
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {totalNetPay.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
