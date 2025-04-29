import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AnalyticsLoading() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="h-7 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 w-full h-64 rounded"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-7 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 w-full h-64 rounded"></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
