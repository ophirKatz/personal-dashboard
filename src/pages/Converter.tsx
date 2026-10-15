import CurrencyConverter from '../features/finance/CurrencyConverter'

export default function Converter() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Converter</h1>
        <p className="text-sm text-muted-foreground">Live exchange rates</p>
      </div>

      <CurrencyConverter />
    </div>
  )
}
