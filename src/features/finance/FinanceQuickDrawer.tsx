import { useEffect, useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { fetchRate } from './currency'
import { fetchQuote } from './stocks'

type QuickItem = {
  key: string
  label: string
  fetcher: () => Promise<string>
}

const QUICK_ITEMS: QuickItem[] = [
  { key: 'usd-nis', label: 'USD → NIS', fetcher: async () => `₪${(await fetchRate('usd', 'ils')).toFixed(4)}` },
  { key: 'eur-nis', label: 'EUR → NIS', fetcher: async () => `₪${(await fetchRate('eur', 'ils')).toFixed(4)}` },
  { key: 'tenb', label: 'TENB', fetcher: async () => `$${(await fetchQuote('TENB')).current.toFixed(2)}` },
]

type ItemState = { value?: string; error?: boolean }

type Props = {
  open: boolean
  onClose: () => void
}

export default function FinanceQuickDrawer({ open, onClose }: Props) {
  const [states, setStates] = useState<Record<string, ItemState>>({})

  useEffect(() => {
    if (!open) return
    setStates({})
    QUICK_ITEMS.forEach(item => {
      item.fetcher()
        .then(value => setStates(s => ({ ...s, [item.key]: { value } })))
        .catch(() => setStates(s => ({ ...s, [item.key]: { error: true } })))
    })
  }, [open])

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick rates</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-3">
          {QUICK_ITEMS.map(item => {
            const state = states[item.key]
            return (
              <div key={item.key} className="flex items-center justify-between p-3.5 bg-card border border-border rounded-xl">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold">
                  {state?.error ? '—' : state?.value ?? (
                    <span className="inline-block h-5 w-16 bg-muted rounded animate-pulse" />
                  )}
                </p>
              </div>
            )
          })}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
