import StockCard from '../features/finance/StockCard'

export default function Stocks() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Stocks</h1>
        <p className="text-sm text-muted-foreground">Quotes & price alerts</p>
      </div>

      <StockCard />
    </div>
  )
}
