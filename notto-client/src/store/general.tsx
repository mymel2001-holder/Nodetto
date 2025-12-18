import { create } from "zustand"

type Store = {
  userId: number | null

  setUserId: (newUserId: number | null) => void
}

export const useGeneral = create<Store>(
  (set) => ({
    userId: null,

    setUserId: (newUserId) => {
      set(() => ({ userId: newUserId }))
    }
  })
)