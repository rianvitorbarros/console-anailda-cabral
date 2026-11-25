const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Replace emerald colors in the Faturamento card with rose
code = code.replace(
  'border-emerald-500/20',
  'border-slate-200 dark:border-slate-800'
);
code = code.replace(
  'from-emerald-50/50 to-transparent dark:from-emerald-900/10',
  ''
);
code = code.replace(
  'bg-emerald-100 dark:bg-emerald-900/50',
  'bg-rose-50 dark:bg-rose-900/30'
);
code = code.replace(
  'text-emerald-600 dark:text-emerald-400',
  'text-rose-600 dark:text-rose-400'
);
code = code.replace(
  'text-emerald-800 dark:text-emerald-400',
  'text-slate-500 dark:text-slate-400'
);
code = code.replace(
  '<h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight relative">',
  '<h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight relative">'
);

// Blue and Indigo in other cards to Rose or standard
code = code.replace(
  'bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400',
  'bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400'
);

code = code.replace(
  'bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400',
  'bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400'
);

// Chart colors
code = code.replace(
  '<stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>',
  '<stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>'
);
code = code.replace(
  '<stop offset="95%" stopColor="#10b981" stopOpacity={0}/>',
  '<stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>'
);
code = code.replace(
  'stroke="#10b981"',
  'stroke="#e11d48"'
);

// Funnel colors
code = code.replace(/"bg-blue-400"/g, '"bg-rose-200"');
code = code.replace(/"bg-indigo-400"/g, '"bg-rose-300"');
code = code.replace(/"bg-violet-400"/g, '"bg-rose-400"');
code = code.replace(/"bg-fuchsia-400"/g, '"bg-rose-500"');
code = code.replace(/"bg-pink-400"/g, '"bg-rose-600"');
code = code.replace(/"bg-rose-400"/g, '"bg-rose-700"');
code = code.replace(/"bg-orange-400"/g, '"bg-rose-800"');
code = code.replace(/"bg-emerald-500"/g, '"bg-rose-900"');

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
