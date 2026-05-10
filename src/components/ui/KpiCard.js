import React from 'react';

export default function KpiCard({ label, value, icon: Icon, gradient, glow, badge, trend, onClick, style, className }) {
  const glowColor = glow || 'rgba(0,0,0,0.2)';
  return (
    <div
      onClick={onClick}
      className={`kpi-card${className ? ' ' + className : ''}`}
      style={{
        background: gradient || 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
        borderRadius: 16,
        padding: '22px 20px',
        minHeight: 130,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 4px 20px ${glowColor}, 0 1px 4px rgba(0,0,0,0.12)`,
        border: '1px solid rgba(255,255,255,0.15)',
        transition: 'transform 0.18s, box-shadow 0.18s',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 10px 30px ${glowColor}, 0 2px 8px rgba(0,0,0,0.18)`;
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = `0 4px 20px ${glowColor}, 0 1px 4px rgba(0,0,0,0.12)`;
      } : undefined}
    >
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: -32, bottom: -32, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      {/* Icon */}
      {Icon && (
        <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
          <Icon size={18} strokeWidth={2} style={{ color: '#ffffff' }} />
        </div>
      )}
      {/* Label */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, position: 'relative' }}>
        {label}
      </div>
      {/* Value */}
      <div className="kpi-val" style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.8px', lineHeight: 1, marginBottom: 8, position: 'relative' }}>
        {value}
      </div>
      {/* Badge + trend */}
      {(badge || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
          {badge && (
            <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>
              {badge}
            </span>
          )}
          {trend && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
