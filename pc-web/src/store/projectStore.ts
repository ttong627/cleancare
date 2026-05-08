import { create } from 'zustand';

type FilterType = 'ALL' | 'EMERGENCY' | 'IN_PROGRESS' | 'COMPLETED';

interface ProjectStore {
  selectedFilter: FilterType;
  setFilter: (filter: FilterType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  selectedFilter: 'ALL',
  setFilter: (filter) => set({ selectedFilter: filter }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
