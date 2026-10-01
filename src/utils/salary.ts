import { Employee, ScheduleEntry, Settings } from '../types';

export function calculateHours(schedule: ScheduleEntry): number {
  if (!schedule.actualStart || !schedule.actualEnd) return 0;
  
  const start = schedule.actualStart.split(':').map(Number);
  const end = schedule.actualEnd.split(':').map(Number);
  
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

export function calculateScheduledHours(schedule: ScheduleEntry): number {
  const start = schedule.startTime.split(':').map(Number);
  const end = schedule.endTime.split(':').map(Number);
  
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

export function getScheduleStatus(schedule: ScheduleEntry): string {
  // Смена завершена - есть и начало, и конец
  if (schedule.actualStart && schedule.actualEnd) {
    return 'opened';
  }
  
  // Смена открыта, но не закрыта - есть начало, но нет конца
  if (schedule.actualStart && !schedule.actualEnd) {
    return 'not-closed';
  }
  
  // Смена запланирована, но не открыта - нет фактического начала
  if (!schedule.actualStart) {
    return 'not-opened';
  }
  
  return 'not-opened';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'opened': return 'bg-green-100 text-green-800';
    case 'not-closed': return 'bg-yellow-100 text-yellow-800';
    case 'not-opened': return 'bg-blue-100 text-blue-800';
    case 'day-off': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-50 text-gray-600';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'opened': return 'Смена открыта';
    case 'not-closed': return 'Смена не закрыта';
    case 'not-opened': return 'Смена не открыта';
    case 'day-off': return 'Выходной';
    default: return status;
  }
}

export function roundToQuarter(minutes: number): number {
  // Округление до 15 минут
  return Math.round(minutes / 15) * 15;
}

export function getEffectiveHours(schedule: ScheduleEntry): number {
  if (!schedule.actualStart || !schedule.actualEnd) {
    return calculateScheduledHours(schedule);
  }
  
  const scheduledStart = schedule.startTime.split(':').map(Number);
  const scheduledEnd = schedule.endTime.split(':').map(Number);
  const actualStart = schedule.actualStart.split(':').map(Number);
  const actualEnd = schedule.actualEnd.split(':').map(Number);
  
  const scheduledStartMin = scheduledStart[0] * 60 + scheduledStart[1];
  const scheduledEndMin = scheduledEnd[0] * 60 + scheduledEnd[1];
  const actualStartMin = actualStart[0] * 60 + actualStart[1];
  const actualEndMin = actualEnd[0] * 60 + actualEnd[1];
  
  // If within 15 minutes, round to scheduled time
  let effectiveStart = actualStartMin;
  let effectiveEnd = actualEndMin;
  
  if (Math.abs(actualStartMin - scheduledStartMin) < 15) {
    effectiveStart = scheduledStartMin;
  }
  if (Math.abs(actualEndMin - scheduledEndMin) < 15) {
    effectiveEnd = scheduledEndMin;
  }
  
  // Округляем общее время до 15 минут
  const totalMinutes = effectiveEnd - effectiveStart;
  const roundedMinutes = roundToQuarter(totalMinutes);
  
  return Math.max(0, roundedMinutes / 60);
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (m === 0) {
    return `${h}ч`;
  }
  return `${h}ч ${m}мин`;
}

export function calculateAdvance(
  employee: Employee,
  schedules: ScheduleEntry[],
  month: number,
  year: number,
  settings: Settings
): number {
  const advanceSchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return s.employeeId === employee.id && d.getMonth() === month && d.getFullYear() === year && d.getDate() <= settings.advanceDay;
  });
  
  if (employee.payType === 'salary') {
    return employee.monthlySalary * 0.4;
  }
  
  const totalHours = advanceSchedules.reduce((sum, s) => sum + getEffectiveHours(s), 0);
  return totalHours * employee.hourlyRate;
}

export function calculateSalary(
  employee: Employee,
  schedules: ScheduleEntry[],
  month: number,
  year: number,
  settings: Settings
): number {
  const salarySchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return s.employeeId === employee.id && d.getMonth() === month && d.getFullYear() === year && d.getDate() > settings.advanceDay;
  });
  
  const totalFines = employee.fines
    .filter(f => {
      const d = new Date(f.date);
      return d.getMonth() === month && d.getFullYear() === year && d.getDate() > settings.advanceDay;
    })
    .reduce((sum, f) => sum + f.amount, 0);
  
  if (employee.payType === 'salary') {
    return employee.monthlySalary * 0.6 + employee.bonus - totalFines;
  }
  
  const totalHours = salarySchedules.reduce((sum, s) => sum + getEffectiveHours(s), 0);
  return totalHours * employee.hourlyRate + employee.bonus - totalFines;
}

export function calculateFullMonth(
  employee: Employee,
  schedules: ScheduleEntry[],
  month: number,
  year: number
): { totalHours: number; totalEarnings: number; totalFines: number; netPay: number } {
  const monthSchedules = schedules.filter(s => {
    const d = new Date(s.date);
    return s.employeeId === employee.id && d.getMonth() === month && d.getFullYear() === year;
  });
  
  const totalHours = monthSchedules.reduce((sum, s) => sum + getEffectiveHours(s), 0);
  const totalFines = employee.fines
    .filter(f => {
      const d = new Date(f.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, f) => sum + f.amount, 0);
  
  let totalEarnings: number;
  if (employee.payType === 'salary') {
    totalEarnings = employee.monthlySalary;
  } else {
    totalEarnings = totalHours * employee.hourlyRate;
  }
  
  const netPay = totalEarnings + employee.bonus - totalFines;
  
  return { totalHours, totalEarnings, totalFines, netPay };
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}
