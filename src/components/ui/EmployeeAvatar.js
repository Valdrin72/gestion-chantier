import React from 'react';

// #4C8FD1 (bleu moyen) et #0E2A4F (bleu nuit) = teintes CYNA, remplacent 2 violets (index 4 et 8).
const COLORS = ['#10b981','#ec4899','#34d399','#f97316','#4C8FD1','#14b8a6','#3b82f6','#f59e0b','#0E2A4F','#ef4444'];

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
