import { Employee, ScheduleEntry, Settings } from '../types';

export async function sendTelegramNotification(
  employee: Employee,
  message: string,
  settings: Settings
): Promise<boolean> {
  if (!settings.telegramBotToken) {
    console.log(`[Telegram Mock] To ${employee.telegramNick}: ${message}`);
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: employee.telegramNick,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Telegram notification failed:', error);
    return false;
  }
}

export async function notifyScheduleChange(
  employees: Employee[],
  schedules: ScheduleEntry[],
  startDate: string,
  endDate: string,
  settings: Settings
): Promise<void> {
  const affectedEmployees = new Set(schedules.map(s => s.employeeId));
  
  for (const employee of employees) {
    if (!affectedEmployees.has(employee.id) || employee.role === 'admin') continue;
    
    const employeeSchedules = schedules
      .filter(s => s.employeeId === employee.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    let scheduleText = `📅 <b>Изменение расписания</b>\n\n`;
    scheduleText += `Период: ${formatDateRu(startDate)} — ${formatDateRu(endDate)}\n\n`;
    scheduleText += `<b>Ваш график:</b>\n`;
    
    for (const s of employeeSchedules) {
      scheduleText += `${formatDateRu(s.date)}: ${s.startTime} — ${s.endTime}\n`;
    }
    
    await sendTelegramNotification(employee, scheduleText, settings);
  }
}

export async function notifyDayStart(
  employees: Employee[],
  schedules: ScheduleEntry[],
  date: string,
  settings: Settings
): Promise<void> {
  const daySchedules = schedules.filter(s => s.date === date);
  
  for (const schedule of daySchedules) {
    const employee = employees.find(e => e.id === schedule.employeeId);
    if (!employee || employee.role === 'admin') continue;
    
    const message = `☀️ <b>Начало рабочего дня</b>\n\n` +
      `Сегодня: ${formatDateRu(date)}\n` +
      `Ваше время: ${schedule.startTime} — ${schedule.endTime}`;
    
    await sendTelegramNotification(employee, message, settings);
  }
}

export async function notifyDayEnd(
  employees: Employee[],
  schedules: ScheduleEntry[],
  date: string,
  settings: Settings
): Promise<void> {
  const daySchedules = schedules.filter(s => s.date === date);
  
  for (const schedule of daySchedules) {
    const employee = employees.find(e => e.id === schedule.employeeId);
    if (!employee || employee.role === 'admin') continue;
    
    const message = `🌙 <b>Конец рабочего дня</b>\n\n` +
      `Сегодня: ${formatDateRu(date)}\n` +
      `Запланированное окончание: ${schedule.endTime}`;
    
    await sendTelegramNotification(employee, message, settings);
  }
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
