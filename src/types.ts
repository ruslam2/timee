export interface Employee {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'employee';
  telegramNick: string;
  position: string;
  payType: 'hourly' | 'salary';
  hourlyRate: number;
  monthlySalary: number;
  bonus: number;
  fines: Fine[];
  hireDate: string;
  isActive: boolean;
  // Admin profile data
  phone?: string;
  email?: string;
  address?: string;
}

export interface Fine {
  id: string;
  date: string;
  amount: number;
  reason: string;
}

export interface ScheduleEntry {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'scheduled' | 'on-time' | 'early' | 'late' | 'left-early' | 'left-late' | 'absent';
}

export interface Settings {
  advanceDay: number; // day of month for advance (e.g., 15)
  salaryDay: number; // day of month for salary (e.g., 1)
  telegramBotToken: string;
  workDayStart: string;
  workDayEnd: string;
}

export interface AppState {
  employees: Employee[];
  schedules: ScheduleEntry[];
  settings: Settings;
  currentUser: Employee | null;
}
