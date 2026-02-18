'use client';
import { useState } from 'react';
import { GLASS_ICONS, GLASS_ICON_GROUPS, GlassIcon } from './GlassIcons';

export default function IconPicker({ value, onChange, onClose }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const groups = GLASS_ICON_GROUPS;
  const filtered = selectedGroup !== null ? [groups[selectedGroup]] : groups;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <div className="glass" style={{ position: 'relative', width: '90%', maxWidth: 540, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Escolher Ícone</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: 4 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(178,77,255,0.08), rgba(0,229,255,0.08))', border: '1px solid rgba(178,77,255,0.15)' }}>
            <GlassIcon icon="sparkle" size={14} color="rgba(178,77,255,0.7)" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Liquid Glass — ícones vetoriais para tema escuro</span>
          </div>
          {/* Group filters */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button className={`chip ${selectedGroup === null ? 'active' : ''}`} onClick={() => setSelectedGroup(null)} style={{ fontSize: 10, padding: '4px 9px' }}>Todos</button>
            {groups.map((g, i) => (
              <button key={i} className={`chip ${selectedGroup === i ? 'active' : ''}`} onClick={() => setSelectedGroup(i)} style={{ fontSize: 10, padding: '4px 9px' }}>{g.label}</button>
            ))}
          </div>
        </div>
        {/* Icons grid */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {filtered.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              {filtered.length > 1 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{group.label}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6 }}>
                {group.keys.map(key => {
                  const def = GLASS_ICONS[key];
                  const selected = value === key;
                  return (
                    <button key={key} onClick={() => { onChange(key); onClose(); }} title={def?.l || key}
                      style={{
                        width: '100%', aspectRatio: '1', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: selected ? '2px solid #B24DFF' : '1px solid rgba(255,255,255,0.06)',
                        background: selected ? 'rgba(178,77,255,0.15)' : 'rgba(255,255,255,0.02)',
                        boxShadow: selected ? '0 0 16px rgba(178,77,255,0.2)' : 'none',
                      }}
                      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; } }}
                      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; } }}>
                      <GlassIcon icon={key} size={22} color={selected ? '#B24DFF' : 'rgba(255,255,255,0.6)'} glow={selected ? 'rgba(178,77,255,0.4)' : undefined} />
                      <span style={{ fontSize: 7, color: selected ? 'rgba(178,77,255,0.8)' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>{def?.l || ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
