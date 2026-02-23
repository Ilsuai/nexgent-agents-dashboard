import React from 'react';
import { LayoutDashboard, BarChart3, Upload, Brain, Settings, Bot, TrendingUp, Users } from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
  const menuItems = [
    { section: 'Dashboard', items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'performance', label: 'Performance', icon: TrendingUp },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ]},
    { section: 'Trading', items: [
      { id: 'agents', label: 'Signal Providers', icon: Brain },
      { id: 'bot-setup', label: 'Webhook', icon: Bot },
    ]},
    { section: 'Data Management', items: [
      { id: 'import', label: 'Import Data', icon: Upload },
    ]},
    { section: 'AI Tools', items: [
      { id: 'ai-analysis', label: 'AI Analysis', icon: Brain },
    ]},
    { section: 'Configuration', items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ]},
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 flex flex-col z-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tighter text-white">
          Trading Bot
        </h1>
        <p className="text-sm text-gray-400 mt-1">Portfolio Dashboard</p>
      </div>

      <nav className="flex-1 px-4 overflow-y-auto py-2">
        {menuItems.map((section, idx) => (
          <div key={idx} className="mb-6">
            <div className="px-3 mb-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
              {section.section}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                    activePage === item.id
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-gray-400 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
