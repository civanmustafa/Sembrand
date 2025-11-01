import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => boolean;
  isDarkMode: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = onLogin(username, password);
    if (!success) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'dark' : ''} bg-[#FAFAFA] dark:bg-[#181818]`}>
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg dark:bg-[#1F1F1F] border border-gray-200 dark:border-[#3C3C3C]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#333333] dark:text-gray-100">محرر المحتوى المتقدم</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">الرجاء تسجيل الدخول للمتابعة</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">اسم المستخدم</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-[#00778e] focus:border-[#00778e] focus:z-10 sm:text-sm dark:bg-[#2A2A2A] dark:border-[#3C3C3C] dark:placeholder-gray-400 dark:text-gray-100"
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">كلمة المرور</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-[#00778e] focus:border-[#00778e] focus:z-10 sm:text-sm dark:bg-[#2A2A2A] dark:border-[#3C3C3C] dark:placeholder-gray-400 dark:text-gray-100"
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/20 dark:text-red-300" role="alert">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-[#00778e] border border-transparent rounded-md hover:bg-[#005f73] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00778e] dark:focus:ring-offset-gray-800"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <LogIn className="w-5 h-5 text-teal-300 group-hover:text-teal-200" aria-hidden="true" />
              </span>
              تسجيل الدخول
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
