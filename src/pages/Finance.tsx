import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import CurrencyConverter from '../features/finance/CurrencyConverter'
import StockCard from '../features/finance/StockCard'
import FinanceSummary from '../features/finance/FinanceSummary'

export default function Finance() {
  const [activeTab, setActiveTab] = useState('')

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Finance</h1>
        <p className="text-sm text-muted-foreground">Currency converter & stocks</p>
      </div>

      <FinanceSummary />

      <Tabs value={activeTab} onValueChange={setActiveTab} activationMode="manual">
        <TabsList className="w-full mb-6">
          <TabsTrigger
            value="converter"
            className="flex-1"
            onMouseDown={() => activeTab === 'converter' && setActiveTab('')}
          >
            Converter
          </TabsTrigger>
          <TabsTrigger
            value="stocks"
            className="flex-1"
            onMouseDown={() => activeTab === 'stocks' && setActiveTab('')}
          >
            Stocks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="converter">
          <CurrencyConverter />
        </TabsContent>

        <TabsContent value="stocks">
          <StockCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
