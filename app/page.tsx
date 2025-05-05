// app/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getShipmentsWithTracking } from '@/services/dbService'
import { getLatestStatus } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Search,
  Filter,
  Plus,
  BarChart,
  Ship,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import ShipmentList from '@/components/ShipmentList'

// Auto-refresh interval (20 minutes)
const AUTO_REFRESH_INTERVAL = 20 * 60 * 1000

// Define types for better type safety
interface Container {
  container_no: string
  status?: string
  gate_in_time?: string
  truck_no?: string
}

interface Shipment {
  id: string
  shipping_order_id: string
  vessel?: string
  containers: Container[]
}

export default function Home() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  // Fetch shipments and enrich containers with live status
  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await getShipmentsWithTracking(false)
      const enriched = await Promise.all(
        data.map(async (sh) => {
          const containers = await Promise.all(
            sh.containers.map(async (c: Container) => {
              try {
                const res = await fetch(
                  `/api/container/${c.container_no}/status`,
                  { cache: 'no-store' }
                )
                if (!res.ok) throw new Error('No status')
                const json = await res.json()
                return {
                  ...c,
                  status:       json.status,
                  gate_in_time: json.gateInTime,
                  truck_no:     json.truckNumber ?? c.truck_no,
                }
              } catch {
                return c
              }
            })
          )
          return { ...sh, containers }
        })
      )
      setShipments(enriched)
      setLastRefreshed(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching shipments:', err)
      setError('Failed to load shipments. Please try again later.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Trigger server-side scrape then reload data
  const onForceRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/scrape', { method: 'POST' })
    } catch (scrapeErr) {
      console.error('Error triggering server scrape:', scrapeErr)
    }
    await fetchData()
  }, [fetchData])

  // Initial load and auto-refresh (scrape+fetch)
  useEffect(() => {
    onForceRefresh()
    if (!autoRefreshEnabled) return
    const iv = setInterval(() => {
      const hr = new Date().getHours()
      if (hr >= 1 && hr < 6) return
      onForceRefresh()
    }, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(iv)
  }, [autoRefreshEnabled, onForceRefresh])

  // Apply search and status filters
  useEffect(() => {
    let fs = shipments
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      fs = fs.filter((sh) =>
        sh.shipping_order_id.toLowerCase().includes(term) ||
        (sh.vessel && sh.vessel.toLowerCase().includes(term)) ||
        sh.containers.some((c) =>
          c.container_no.toLowerCase().includes(term) ||
          (c.truck_no && c.truck_no.toLowerCase().includes(term))
        )
      )
    }
    if (statusFilter !== 'all') {
      fs = fs.filter((sh) =>
        sh.containers.some(
          (c) => (c.status ?? '').toLowerCase() === statusFilter
        )
      )
    }
    setFilteredShipments(fs)
  }, [shipments, searchTerm, statusFilter])

  const formatRefreshTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleArchive = (shipmentId: string) =>
    setShipments((prev) => prev.filter((s) => s.id !== shipmentId))

  // Loading skeleton
  if (loading && !shipments.length) {
    return (
      <div className="px-4 py-4 max-w-full">
        <div className="flex items-center gap-3 mb-6">
          <Ship className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Container Tracker</h1>
        </div>
        <div className="shipments-wrapper">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[500px] w-full rounded-lg mb-4" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 max-w-full">
      {/* Header and controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <Ship className="h-8 w-8 text-teal-600" />
          <h1 className="text-3xl font-bold">Container Tracker</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Last updated: {formatRefreshTime(lastRefreshed)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onForceRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefreshEnabled}
              onCheckedChange={setAutoRefreshEnabled}
              id="auto-refresh-toggle"
            />
            <label
              htmlFor="auto-refresh-toggle"
              className={`text-sm cursor-pointer ${
                autoRefreshEnabled ? 'text-teal-600 font-medium' : 'text-gray-500'
              }`}
            >
              Auto-refresh every 20 minutes
            </label>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
          <Button onClick={onForceRefresh} className="mt-2 bg-red-600 text-white">
            Retry
          </Button>
        </div>
      )}

      {/* Search / Filter / Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9"
            placeholder="Search by order, vessel, container or truck..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="gate in">Gate-In</SelectItem>
              <SelectItem value="in transit">In Transit</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Link href="/analytics">
            <Button variant="outline" className="flex items-center gap-1">
              <BarChart className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link href="/shipping-orders/new">
            <Button className="bg-teal-600 hover:bg-teal-700 flex items-center gap-1">
              <Plus className="h-4 w-4" />
              New Shipping Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Shipments or Empty State */}
      {filteredShipments.length === 0 ? (
        <div className="bg-yellow-50 border-yellow-200 text-yellow-800 px-4 py-8 rounded text-center">
          {searchTerm || statusFilter !== 'all' ? (
            <>
              <p className="text-lg font-medium">No shipments match your filters</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No shipments found.</p>
              <Link href="/shipping-orders/new">
                <Button className="mt-4 bg-teal-600 hover:bg-teal-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Shipping Order
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <ShipmentList
          shipments={filteredShipments}
          onArchive={handleArchive}
          className="grid-cols-3"
        />
      )}
    </div>
  )
}
