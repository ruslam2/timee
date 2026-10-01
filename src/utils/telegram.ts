import { Employee, ScheduleEntry, Settings } from '../types';

export async function sendTelegramNotification(
  employee: Employee,
  message: string,
  settings: Settings
): Promise<boolean> {
  if (!settings.telegramBotToken) {
    console.log(`[Telegram Mock] To chat_id=${employee.telegramChatId}: ${message}`);
    return false;
  }

  // Используем числовой chat_id, а не username
  const chatId = employee.telegramChatId;
  if (!chatId) {
    console.warn(`[Telegram] У сотрудника ${employee.name} не указан Chat ID`);
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[Telegram] Ошибка отправки:`, errorData);
    }
    
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
  
  let sentCount = 0;
  let failedCount = 0;
  
  for (const employee of employees) {
    if (!affectedEmployees.has(employee.id) || employee.role === 'admin') continue;
    if (!employee.telegramChatId) {
      console.warn(`[Telegram] Пропущен ${employee.name} — нет Chat ID`);
      failedCount++;
      continue;
    }
    
    const employeeSchedules = schedules
      .filter(s => s.employeeId === employee.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    let scheduleText = `📅 <b>Изменение расписания</b>\n\n`;
    scheduleText += `Период: ${formatDateRu(startDate)} — ${formatDateRu(endDate)}\n\n`;
    scheduleText += `<b>Ваш график:</b>\n`;
    
    for (const s of employeeSchedules) {
      scheduleText += `${formatDateRu(s.date)}: ${s.startTime} — ${s.endTime}\n`;
    }
    
    const success = await sendTelegramNotification(employee, scheduleText, settings);
    if (success) sentCount++;
    else failedCount++;
  }
  
  return;
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
    if (!employee.telegramChatId) continue;
    
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
    if (!employee.telegramChatId) continue;
    
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
