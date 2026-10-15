import { useEffect, useState } from 'react'
import { Lock, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { ALL_NAV_KEYS, NAV_ITEMS } from '../../lib/navItems'
import type { NavItemKey } from '../../lib/navItems'
import { DEFAULT_LOCK_CODE } from '../../lib/pageLock'
import { useLock } from './LockProvider'
import PinPad from './PinPad'

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

// Two entries: choose the code, then type it again to confirm.
function ChangeCodeDrawer({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const lock = useLock()
  const [step, setStep] = useState<'new' | 'confirm'>('new')
  const [firstEntry, setFirstEntry] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <Drawer open onOpenChange={v => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Change code</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="pb-6">
          <PinPad
            key={step}
            title={step === 'new' ? 'Choose a new code' : 'Confirm the new code'}
            subtitle={step === 'new' ? notice ?? '4 digits' : 'Type it once more'}
            onSubmit={async code => {
              if (step === 'new') {
                setFirstEntry(code)
                setNotice(null)
                setStep('confirm')
                return { ok: true }
              }
              if (code !== firstEntry) {
                setNotice("The codes didn't match. Try again.")
                setStep('new')
                return { ok: true }
              }
              try {
                await lock.changeCode(code)
              } catch {
                return { ok: false, message: "Couldn't save the code. Try again." }
              }
              onChanged()
              return { ok: true }
            }}
            onCancel={onClose}
          />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

export default function PageLockSettings() {
  const lock = useLock()
  const [managing, setManaging] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [changingCode, setChangingCode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Managing the lock is itself behind the code, and closes again if the app auto-locks.
  useEffect(() => {
    setManaging(false)
    setChangingCode(false)
    setVerifying(false)
  }, [lock.relockCount])

  async function toggle(key: NavItemKey) {
    haptic('selection')
    setMessage(null)
    const next = lock.lockedPages.includes(key) ? lock.lockedPages.filter(k => k !== key) : [...lock.lockedPages, key]
    try {
      await lock.changeLockedPages(ALL_NAV_KEYS.filter(k => next.includes(k)))
    } catch {
      setMessage("Couldn't save that change.")
    }
  }

  const lockedLabels = lock.lockedPages.map(k => NAV_ITEMS[k].label)

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Ask for a code</p>
          <p className="text-sm text-muted-foreground">
            Pages you lock ask for a 4-digit code every time you open them.
          </p>
        </div>
      </div>

      {lock.status === 'error' && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-destructive">Couldn't load the lock settings.</span>
          <Button variant="outline" size="sm" onClick={lock.retry}>Retry</Button>
        </div>
      )}

      {lock.status === 'ready' && (
        <>
          {lock.usingDefaultCode && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-100 p-3 text-sm text-amber-800">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>You're still using the default code ({DEFAULT_LOCK_CODE}). Change it so the lock means something.</span>
            </div>
          )}

          {!managing ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Locked: </span>
                {lockedLabels.length > 0 ? lockedLabels.join(', ') : 'nothing'}
              </p>
              <Button variant="outline" className="w-full" onClick={() => setVerifying(true)}>
                Manage page lock
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <ul className="divide-y divide-border rounded-xl border border-border">
                {ALL_NAV_KEYS.map(key => {
                  const { icon: Icon, label } = NAV_ITEMS[key]
                  return (
                    <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      <Switch checked={lock.lockedPages.includes(key)} onChange={() => toggle(key)} label={`Lock ${label}`} />
                    </li>
                  )
                })}
              </ul>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setChangingCode(true)}>Change code</Button>
                <Button className="flex-1" onClick={() => { setManaging(false); setMessage(null) }}>Done</Button>
              </div>
            </div>
          )}
        </>
      )}

      {verifying && (
        <Drawer open onOpenChange={v => !v && setVerifying(false)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Page lock</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="pb-6">
              <PinPad
                title="Enter your code"
                subtitle="to change the page lock"
                lockedUntil={lock.lockedUntil}
                onSubmit={code => {
                  const result = lock.submitCode(code)
                  if (result.ok) {
                    setVerifying(false)
                    setManaging(true)
                  }
                  return result
                }}
                onCancel={() => setVerifying(false)}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}

      {changingCode && (
        <ChangeCodeDrawer
          onClose={() => setChangingCode(false)}
          onChanged={() => {
            setChangingCode(false)
            setMessage(null)
            haptic('success')
          }}
        />
      )}
    </div>
  )
}
