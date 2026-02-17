'use client';
import { useState } from 'react';

const ICON_GROUPS = [
  { label: 'Finanças', icons: ['💰','💳','💵','💎','🏦','📊','📈','📉','💹','🪙','💲','🏧','🧾','💸','🤑'] },
  { label: 'Casa & Moradia', icons: ['🏠','🏡','🏢','🏗️','🔑','🛋️','🛏️','🚿','💡','🔌','🧹','🪴','🏘️','🪑','🧊'] },
  { label: 'Transporte', icons: ['🚗','🚕','🏍️','🚌','✈️','🚇','🚲','⛽','🛞','🚙','🛻','🚐','🛵','🚢','🛩️'] },
  { label: 'Alimentação', icons: ['🍽️','🛒','🥗','☕','🍕','🍔','🥩','🍺','🧁','🍳','🥤','🛍️','🍣','🌮','🧆'] },
  { label: 'Saúde', icons: ['💊','🏥','🩺','🦷','💉','🩹','❤️','🧠','👁️','🏃','🧘','🩻','💪','🫀','🩸'] },
  { label: 'Educação', icons: ['📚','🎓','📝','✏️','🖥️','📖','🎒','🧑‍🏫','📐','🔬','🗂️','📕','🌐','🧪','📏'] },
  { label: 'Lazer', icons: ['🎮','🎬','🎵','🎭','⚽','🎪','🎯','🏖️','🎨','🎤','🎧','🎳','🏕️','🎺','🎻'] },
  { label: 'Vestuário', icons: ['👔','👗','👟','🧥','👜','🕶️','💍','👒','🧢','👞','🩳','👠','🧤','🧣','👙'] },
  { label: 'Serviços', icons: ['⚡','💧','📡','📱','🛜','📺','🧰','🔧','🪠','📮','🧑‍💻','📞','🛡️','🔒','⚙️'] },
  { label: 'Veículos & Bens', icons: ['🚗','🏠','🏍️','⛵','🖥️','📱','⌚','💎','🎸','📷','🎺','🏎️','🚁','🛥️','🏟️'] },
  { label: 'Investimentos', icons: ['📈','💹','🏦','🪙','💎','📊','🏗️','🌾','⛏️','🛢️','🔋','☀️','🏭','🤖','🌍'] },
  { label: 'Outros', icons: ['📦','🎁','🐾','👶','✨','🌟','⭐','🔔','🏷️','📌','🎈','🪄','🧩','🎀','♻️'] },
];

export default function IconPicker({ value, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const filtered = selectedGroup !== null
    ? [ICON_GROUPS[selectedGroup]]
    : ICON_GROUPS;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <div className="glass" style={{ position: 'relative', width: '90%', maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Escolher Ícone</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
          </div>
          {/* Group filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className={`chip ${selectedGroup === null ? 'active' : ''}`} onClick={() => setSelectedGroup(null)} style={{ fontSize: 11, padding: '5px 10px' }}>Todos</button>
            {ICON_GROUPS.map((g, i) => (
              <button key={i} className={`chip ${selectedGroup === i ? 'active' : ''}`} onClick={() => setSelectedGroup(i)} style={{ fontSize: 11, padding: '5px 10px' }}>{g.label}</button>
            ))}
          </div>
        </div>
        {/* Icons grid */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {filtered.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              {filtered.length > 1 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{group.label}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: 6 }}>
                {group.icons.map((icon, ii) => (
                  <button key={ii} onClick={() => { onChange(icon); onClose(); }}
                    style={{
                      width: 48, height: 48, borderRadius: 14, border: icon === value ? '2px solid #B24DFF' : '1px solid rgba(255,255,255,0.06)',
                      background: icon === value ? 'rgba(178,77,255,0.15)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s ease', boxShadow: icon === value ? '0 0 16px rgba(178,77,255,0.2)' : 'none'
                    }}
                    onMouseEnter={e => { if (icon !== value) e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (icon !== value) e.target.style.background = 'rgba(255,255,255,0.03)'; }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
