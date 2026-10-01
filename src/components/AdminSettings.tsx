import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Clock, Calendar, MessageSquare } from 'lucide-react';

export default function AdminSettings() {
  const { state, dispatch } = useApp();
  const [settings, setSettings] = useState(state.settings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Настройки</h2>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      <div className="grid gap-6">
        {/* Work Hours */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Рабочее время по умолчанию</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Начало дня</label>
              <input
                type="time"
                value={settings.workDayStart}
                onChange={e => setSettings({ ...settings, workDayStart: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Конец дня</label>
              <input
                type="time"
                value={settings.workDayEnd}
                onChange={e => setSettings({ ...settings, workDayEnd: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Дни выплат</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                День аванса (число месяца)
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={settings.advanceDay}
                onChange={e => setSettings({ ...settings, advanceDay: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Аванс: с 1 по {settings.advanceDay} число
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                День зарплаты (число месяца)
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={settings.salaryDay}
                onChange={e => setSettings({ ...settings, salaryDay: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Зарплата: с {settings.advanceDay + 1} по последнее число
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Правила расчёта:</strong><br />
              • Почасовые: аванс = фактическая ставка × часы (1-{settings.advanceDay}), зарплата = ставка × часы + премия - штрафы ({settings.advanceDay + 1}-конец)<br />
              • Оклад: аванс = 40% от оклада, зарплата = 60% + премия - штрафы
            </p>
          </div>
        </div>

        {/* Telegram */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-sky-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Telegram бот</h3>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Токен бота
            </label>
            <input
              type="text"
              value={settings.telegramBotToken}
              onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            />
            <p className="text-xs text-gray-500 mt-1">
              Получите токен у @BotFather в Telegram
            </p>
          </div>
          <div className="mt-4 p-3 bg-sky-50 rounded-lg">
            <p className="text-sm text-sky-800">
              <strong>Уведомления отправляются:</strong><br />
              • При изменении расписания — всем затронутым сотрудникам<br />
              • В начале рабочего дня — сотрудникам с запланированной сменой<br />
              • В конце рабочего дня — сотрудникам с запланированной сменой
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
