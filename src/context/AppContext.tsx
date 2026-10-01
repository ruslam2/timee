import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Employee, ScheduleEntry, Settings, AppState } from '../types';

const defaultSettings: Settings = {
  advanceDay: 15,
  salaryDay: 1,
  telegramBotToken: '',
  workDayStart: '09:00',
  workDayEnd: '18:00',
};

const defaultAdmin: Employee = {
  id: 'admin-1',
  name: 'Администратор',
  pin: '0000',
  role: 'admin',
  telegramNick: '@admin_bot',
  position: 'Администратор',
  payType: 'salary',
  hourlyRate: 0,
  monthlySalary: 80000,
  bonus: 0,
  fines: [],
  hireDate: '2024-01-01',
  isActive: true,
  phone: '',
  email: '',
  address: '',
};

const initialState: AppState = {
  employees: [defaultAdmin],
  schedules: [],
  settings: defaultSettings,
  currentUser: null,
};

type Action =
  | { type: 'LOGIN'; payload: Employee }
  | { type: 'LOGOUT' }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'DELETE_EMPLOYEE'; payload: string }
  | { type: 'ADD_SCHEDULE'; payload: ScheduleEntry }
  | { type: 'UPDATE_SCHEDULE'; payload: ScheduleEntry }
  | { type: 'DELETE_SCHEDULE'; payload: string }
  | { type: 'SET_SCHEDULES'; payload: ScheduleEntry[] }
  | { type: 'UPDATE_SETTINGS'; payload: Settings }
  | { type: 'ADD_FINE'; payload: { employeeId: string; fine: { id: string; date: string; amount: number; reason: string } } }
  | { type: 'REMOVE_FINE'; payload: { employeeId: string; fineId: string } }
  | { type: 'UPDATE_ADMIN_PROFILE'; payload: Partial<Employee> }
  | { type: 'LOAD_STATE'; payload: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUser: action.payload };
    case 'LOGOUT':
      return { ...state, currentUser: null };
    case 'ADD_EMPLOYEE':
      return { ...state, employees: [...state.employees, action.payload] };
    case 'UPDATE_EMPLOYEE':
      return {
        ...state,
        employees: state.employees.map(e =>
          e.id === action.payload.id ? action.payload : e
        ),
      };
    case 'DELETE_EMPLOYEE':
      return {
        ...state,
        employees: state.employees.filter(e => e.id !== action.payload),
        schedules: state.schedules.filter(s => s.employeeId !== action.payload),
      };
    case 'ADD_SCHEDULE':
      return { ...state, schedules: [...state.schedules, action.payload] };
    case 'UPDATE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.map(s =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'DELETE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.filter(s => s.id !== action.payload),
      };
    case 'SET_SCHEDULES':
      return { ...state, schedules: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: action.payload };
    case 'ADD_FINE':
      return {
        ...state,
        employees: state.employees.map(e =>
          e.id === action.payload.employeeId
            ? { ...e, fines: [...e.fines, action.payload.fine] }
            : e
        ),
      };
    case 'REMOVE_FINE':
      return {
        ...state,
        employees: state.employees.map(e =>
          e.id === action.payload.employeeId
            ? { ...e, fines: e.fines.filter(f => f.id !== action.payload.fineId) }
            : e
        ),
      };
    case 'UPDATE_ADMIN_PROFILE':
      return {
        ...state,
        employees: state.employees.map(e =>
          e.role === 'admin' ? { ...e, ...action.payload } : e
        ),
        currentUser: state.currentUser?.role === 'admin'
          ? { ...state.currentUser, ...action.payload }
          : state.currentUser,
      };
    case 'LOAD_STATE':
      return action.payload;
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    const saved = localStorage.getItem('employee-management-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem('employee-management-state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
