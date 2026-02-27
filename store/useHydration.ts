import { useEffect, useState } from 'react'
import { usePokerStore } from './usePokerStore'

export function useHydration() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const unsub = usePokerStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    // Already hydrated (e.g. no storage or sync hydration)
    if (usePokerStore.persist.hasHydrated()) {
      setHydrated(true)
    }

    return unsub
  }, [])

  return hydrated
}
