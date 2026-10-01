import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, User } from 'lucide-react';

export default function LoginPage() {
  const { state, dispatch } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogin = () => {
    const employee = state.employees.find(e => e.pin === pin && e.isActive);
    if (employee) {
      dispatch({ type: 'LOGIN', payload: employee });
      setError('');
    } else {
      setError('Неверный PIN-код');
      setPin('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Вход в систему</h1>
          <p className="text-blue-300 mt-2">Введите ваш PIN-код</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-white/10">
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                  i < pin.length
                    ? 'bg-blue-500 border-blue-400 scale-110'
                    : 'border-white/30'
                }`}
              >
                {i < pin.length && <div className="w-3 h-3 bg-white rounded-full" />}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-center text-sm mb-4 animate-pulse">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xl font-semibold transition-all active:scale-95 border border-white/10"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-blue-300 text-sm font-medium transition-all active:scale-95 border border-white/10"
            >
              Очистить
            </button>
            <button
              onClick={() => handleDigit('0')}
              className="h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xl font-semibold transition-all active:scale-95 border border-white/10"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="h-14 rounded-xl bg-white/5 hover:bg-white/10 text-blue-300 text-sm font-medium transition-all active:scale-95 border border-white/10"
            >
              ←
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={pin.length < 4}
            className="w-full mt-6 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-600/30"
          >
            Войти
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-blue-400/60 text-xs">
            PIN администратора: 0000
          </p>
        </div>
      </div>
    </div>
  );
}
