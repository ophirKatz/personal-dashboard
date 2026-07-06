import { useState } from 'react'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { UNIT_OPTIONS, FRACTION_OPTIONS } from './units'

export type IngredientDraft = {
  key: string
  quantity: string
  unit: string
  name: string
  note: string
}

type Props = {
  value: IngredientDraft
  onChange: (patch: Partial<IngredientDraft>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export default function IngredientRow({ value, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: Props) {
  const isKnownUnit = value.unit === '' || (UNIT_OPTIONS as readonly string[]).includes(value.unit)
  const [customUnit, setCustomUnit] = useState(!isKnownUnit)

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-1.5">
        <div className="flex flex-col gap-1 pt-0.5">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="p-0.5 rounded text-muted-foreground disabled:opacity-30 hover:bg-accent">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="p-0.5 rounded text-muted-foreground disabled:opacity-30 hover:bg-accent">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={value.quantity}
              onChange={e => onChange({ quantity: e.target.value })}
              placeholder="Qty"
              className="w-16 text-center"
            />
            {customUnit ? (
              <div className="flex-1 flex gap-1.5">
                <Input value={value.unit} onChange={e => onChange({ unit: e.target.value })} placeholder="Unit" className="flex-1" />
                <button
                  type="button"
                  onClick={() => { setCustomUnit(false); onChange({ unit: '' }) }}
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-1"
                >
                  List
                </button>
              </div>
            ) : (
              <Select
                value={value.unit || '__none__'}
                onValueChange={v => {
                  if (v === '__other__') { setCustomUnit(true); onChange({ unit: '' }) }
                  else onChange({ unit: v === '__none__' ? '' : v })
                }}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No unit</SelectItem>
                  {UNIT_OPTIONS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                  <SelectItem value="__other__">Other…</SelectItem>
                </SelectContent>
              </Select>
            )}
            <button type="button" onClick={onRemove} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1">
            {FRACTION_OPTIONS.map(f => (
              <button
                key={f.label}
                type="button"
                onClick={() => onChange({ quantity: String(f.value) })}
                className="w-7 h-7 rounded-md border border-input text-sm hover:bg-accent"
              >
                {f.label}
              </button>
            ))}
          </div>

          <Input value={value.name} onChange={e => onChange({ name: e.target.value })} placeholder="Ingredient" />
          <Input value={value.note} onChange={e => onChange({ note: e.target.value })} placeholder="Note (optional)" />
        </div>
      </div>
    </div>
  )
}
