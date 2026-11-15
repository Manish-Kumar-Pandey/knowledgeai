'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Layers,
  FileText,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  Users,
  Settings,
  ChevronDown,
  Sparkles,
  Sliders,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare, badge: 'RAG' },
  { name: 'Knowledge Bases', href: '/knowledge-bases', icon: Layers },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Evaluation', href: '/evaluation', icon: CheckCircle2 },
  { name: 'User Management', href: '/users', icon: Users },
  { name: 'RAG Settings', href: '/settings/rag', icon: Sliders },
  { name: 'Organization', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarOpen,
    toggleSidebar,
    theme,
    toggleTheme,
    user,
    currentOrganization,
    organizations,
    setCurrentOrganization,
    logout,
  } = useAppStore();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-20'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-zinc-900 dark:text-white leading-none">
                KnowledgeAI
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-brand-500 mt-0.5">
                Enterprise RAG
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Organization Switcher */}
      {sidebarOpen ? (
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative group">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 px-3 py-2 text-left text-xs cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Workspace
                </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                  {currentOrganization?.name || 'Acme Global'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600" />
            </div>
          </div>
        </div>
      ) : (
        <div className="py-3 flex justify-center border-b border-zinc-200 dark:border-zinc-800">
          <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-brand-500">
            {currentOrganization?.name?.charAt(0) || 'A'}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'
                )}
              />
              {sidebarOpen && (
                <div className="flex flex-1 items-center justify-between truncate">
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-500">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile & Actions */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        <button
          onClick={toggleTheme}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors',
            !sidebarOpen && 'justify-center'
          )}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-2.5',
            !sidebarOpen && 'justify-center'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white font-semibold text-xs">
            {user?.full_name ? user.full_name.charAt(0) : 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 truncate">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {user?.full_name || 'Dr. Sarah Connor'}
              </p>
              <p className="text-[10px] text-zinc-400 truncate capitalize">
                {user?.role ? user.role.replace('_', ' ') : 'Org Admin'}
              </p>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={logout}
              title="Logout"
              className="text-zinc-400 hover:text-red-500 p-1 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
