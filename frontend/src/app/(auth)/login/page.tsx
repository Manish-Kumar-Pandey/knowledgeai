'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Sparkles, ArrowRight, ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setCurrentOrganization, setOrganizations } = useAppStore();

  const [email, setEmail] = useState('admin@knowledgeai.internal');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await ApiClient.post('/auth/login', { email, password });
      if (res && res.tokens) {
        localStorage.setItem('knowledgeai_token', res.tokens.accessToken);
        localStorage.setItem('knowledgeai_refresh_token', res.tokens.refreshToken);
        localStorage.setItem('knowledgeai_active_org_id', res.currentOrganization.id);

        setUser({
          id: res.user.id,
          email: res.user.email,
          full_name: res.user.full_name,
          avatar_url: res.user.avatar_url,
          role: res.currentOrganization.role,
        });

        setCurrentOrganization(res.currentOrganization);
        setOrganizations(res.organizations || [res.currentOrganization]);

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const autofillDemo = () => {
    setEmail('admin@knowledgeai.internal');
    setPassword('Password123!');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Sign in to KnowledgeAI</h2>
          <p className="text-sm text-zinc-400">Enterprise Knowledge Base & Modular RAG Assistant</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Password
              </label>
              <span className="text-xs text-brand-400 hover:underline cursor-pointer">
                Forgot password?
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:opacity-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Sign In <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-xs text-zinc-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Pre-configured Enterprise Demo
            </span>
            <button
              onClick={autofillDemo}
              className="text-[11px] font-medium text-brand-400 hover:text-brand-300 underline"
            >
              Autofill
            </button>
          </div>
          <p className="text-zinc-500 text-[11px]">
            Email: <code className="text-zinc-300 font-mono">admin@knowledgeai.internal</code>
            <br />
            Pass: <code className="text-zinc-300 font-mono">Password123!</code> (Role: Org Admin)
          </p>
        </div>

        <div className="text-center text-xs text-zinc-400">
          Need a workspace?{' '}
          <Link href="/register" className="font-semibold text-brand-400 hover:underline">
            Register new organization
          </Link>
        </div>
      </div>
    </div>
  );
}
