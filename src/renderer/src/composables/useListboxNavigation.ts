export const LISTBOX_PAGE_SIZE_FALLBACK = 10

type OverflowYReader = (element: HTMLElement) => string

interface PageSizeEnvironment {
  overflowYFor?: OverflowYReader
  viewportHeight?: number
}

function browserOverflowYFor(element: HTMLElement): string {
  return getComputedStyle(element).overflowY
}

// Start at the supplied element itself so a future independently scrolling
// list body is measured instead of being skipped in favor of an ancestor.
export function findListboxScrollParent(
  element: HTMLElement,
  overflowYFor: OverflowYReader = browserOverflowYFor
): HTMLElement | null {
  let node: HTMLElement | null = element

  while (node) {
    const overflowY = overflowYFor(node)

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return node
    }

    node = node.parentElement
  }

  return null
}

export function listboxPageSizeFor(
  listElement: HTMLElement | null,
  environment: PageSizeEnvironment = {}
): number {
  if (!listElement) {
    return LISTBOX_PAGE_SIZE_FALLBACK
  }

  // Do not assume the first child is a task; a future empty/load-more sentinel
  // must not become the row-height probe.
  const firstRow = listElement.querySelector<HTMLElement>('.todo-item')
  const rowHeight = firstRow?.offsetHeight ?? 0

  if (rowHeight <= 0) {
    return LISTBOX_PAGE_SIZE_FALLBACK
  }

  const scroller = findListboxScrollParent(
    listElement,
    environment.overflowYFor ?? browserOverflowYFor
  )
  const viewportHeight = scroller?.clientHeight ?? environment.viewportHeight ?? window.innerHeight

  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1)
}
