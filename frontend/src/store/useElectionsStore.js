import { create } from "zustand";
import { electionService } from "../services/electionService";

const useElectionsStore = create((set, get) => ({
  elections:         [],
  selectedElectionId: null,
  selectedFips:      null,
  selectedState:     null,
  electionsLoaded:   false,

  loadElections: async () => {
    if (get().electionsLoaded) return;
    try {
      const elections = await electionService.getAll();
      // default to the most recent election (already sorted desc by backend)
      const defaultId = elections[0]?.election_id ?? null;
      set({ elections, selectedElectionId: defaultId, electionsLoaded: true });
    } catch {
      set({ electionsLoaded: true });
    }
  },

  setElection: (id) => set({ selectedElectionId: id }),
  setCounty:   (fips) => set({ selectedFips: fips }),
  setState:    (abbr) => set({ selectedState: abbr }),
}));

export default useElectionsStore;
