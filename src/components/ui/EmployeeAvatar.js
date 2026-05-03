import React from 'react';

const COLORS = ['#10b981','#ec4899','#34d399','#f97316','#8b5cf6','#14b8a6','#3b82f6','#f59e0b','#6366f1','#ef4444'];

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export default function EmployeeAvatar({ name = '', size = 40, fontSize }) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const color = COLORS[hashName(name) % COLORS.length];
  const fs = fontSize || Math.round(size * 0.38);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: fs, flexShrink: 0, userSelect: 'none' }}>
      {initials}
    </div>
  );
}
