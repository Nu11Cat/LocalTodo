import { describe, expect, it, vi } from 'vitest'
import {
  findListboxScrollParent,
  LISTBOX_PAGE_SIZE_FALLBACK,
  listboxPageSizeFor
} from './useListboxNavigation'

function element(
  overrides: Partial<Pick<HTMLElement, 'clientHeight' | 'offsetHeight' | 'parentElement'>> = {}
): HTMLElement {
  return {
    clientHeight: 0,
    offsetHeight: 0,
    parentElement: null,
    ...overrides
  } as HTMLElement
}

function listElement(row: HTMLElement | null, parentElement: HTMLElement | null = null): HTMLElement {
  return {
    clientHeight: 0,
    offsetHeight: 0,
    parentElement,
    querySelector: vi.fn(() => row)
  } as unknown as HTMLElement
}

describe('findListboxScrollParent', () => {
  it('returns the list itself when it owns scrolling', () => {
    const list = listElement(null)

    expect(findListboxScrollParent(list, () => 'auto')).toBe(list)
  })

  it('walks to the first scrolling ancestor', () => {
    const scroller = element({ clientHeight: 300 })
    const wrapper = element({ parentElement: scroller })
    const list = listElement(null, wrapper)
    const overflowYFor = vi.fn((candidate: HTMLElement) =>
      candidate === scroller ? 'scroll' : 'visible'
    )

    expect(findListboxScrollParent(list, overflowYFor)).toBe(scroller)
    expect(overflowYFor).toHaveBeenCalledTimes(3)
  })

  it('returns null when no element clips vertical overflow', () => {
    const parent = element()
    const list = listElement(null, parent)

    expect(findListboxScrollParent(list, () => 'visible')).toBeNull()
  })
})

describe('listboxPageSizeFor', () => {
  it('uses the fallback before mount or when row height is unavailable', () => {
    expect(listboxPageSizeFor(null)).toBe(LISTBOX_PAGE_SIZE_FALLBACK)
    expect(listboxPageSizeFor(listElement(element({ offsetHeight: 0 })))).toBe(
      LISTBOX_PAGE_SIZE_FALLBACK
    )
  })

  it('measures the scrolling ancestor and leaves one overlapping row', () => {
    const scroller = element({ clientHeight: 300 })
    const list = listElement(element({ offsetHeight: 30 }), scroller)

    expect(
      listboxPageSizeFor(list, {
        overflowYFor: (candidate) => (candidate === scroller ? 'auto' : 'visible'),
        viewportHeight: 900
      })
    ).toBe(9)
  })

  it('falls back to the viewport when there is no scrolling ancestor', () => {
    const list = listElement(element({ offsetHeight: 40 }))

    expect(
      listboxPageSizeFor(list, {
        overflowYFor: () => 'visible',
        viewportHeight: 240
      })
    ).toBe(5)
  })

  it('never returns less than one row', () => {
    const list = listElement(element({ offsetHeight: 100 }))

    expect(
      listboxPageSizeFor(list, {
        overflowYFor: () => 'visible',
        viewportHeight: 20
      })
    ).toBe(1)
  })
})
