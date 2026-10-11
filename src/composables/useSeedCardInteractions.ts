import type { SeedCardSeed } from './useSeedCardPresentation'

interface SeedCardInteractionOptions {
  seed: SeedCardSeed
  mode: 'select' | 'quantity'
  count: number
}

interface SeedCardCallbacks {
  updateSelected: (selected: boolean) => void
  add: (id: string) => void
  remove: (id: string) => void
  delete: (id: string) => void
}

/** Forward user actions without owning a market's selection or quantity state. */
export function useSeedCardInteractions(options: SeedCardInteractionOptions, callbacks: SeedCardCallbacks) {
  function updateSelected(value: boolean | string | number) {
    if (options.mode === 'select' && typeof value === 'boolean') callbacks.updateSelected(value)
  }

  function addSeed() {
    if (options.mode === 'quantity') callbacks.add(options.seed.id)
  }

  function removeSeed() {
    if (options.mode === 'quantity' && options.count > 0) callbacks.remove(options.seed.id)
  }

  function deleteSeed() {
    if (options.seed.custom) callbacks.delete(options.seed.id)
  }

  return { updateSelected, addSeed, removeSeed, deleteSeed }
}
