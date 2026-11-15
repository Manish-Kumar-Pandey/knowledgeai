import { create } from 'zustand';

export interface UserState {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'super_admin' | 'org_admin' | 'kb_manager' | 'employee';
}

export interface OrgState {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AppStore {
  user: UserState | null;
  currentOrganization: OrgState | null;
  organizations: OrgState[];
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeCitationModal: {
    isOpen: boolean;
    citation: any | null;
  };
  setUser: (user: UserState | null) => void;
  setCurrentOrganization: (org: OrgState | null) => void;
  setOrganizations: (orgs: OrgState[]) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  openCitationModal: (citation: any) => void;
  closeCitationModal: () => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  currentOrganization: null,
  organizations: [],
  theme: 'dark',
  sidebarOpen: true,
  activeCitationModal: {
    isOpen: false,
    citation: null,
  },
  setUser: (user) => set({ user }),
  setCurrentOrganization: (currentOrganization) => {
    if (typeof window !== 'undefined' && currentOrganization) {
      localStorage.setItem('knowledgeai_active_org_id', currentOrganization.id);
    }
    set({ currentOrganization });
  },
  setOrganizations: (organizations) => set({ organizations }),
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('knowledgeai_theme', newTheme);
      }
      return { theme: newTheme };
    }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openCitationModal: (citation) =>
    set({
      activeCitationModal: {
        isOpen: true,
        citation,
      },
    }),
  closeCitationModal: () =>
    set({
      activeCitationModal: {
        isOpen: false,
        citation: null,
      },
    }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('knowledgeai_token');
      localStorage.removeItem('knowledgeai_refresh_token');
      localStorage.removeItem('knowledgeai_active_org_id');
      window.location.href = '/login';
    }
    set({ user: null, currentOrganization: null, organizations: [] });
  },
}));
