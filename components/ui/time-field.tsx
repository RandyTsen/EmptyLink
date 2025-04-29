"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface TimeFieldProps {
  value: { hours: number; minutes: number }
  onChange: (value: { hours: number; minutes: number }) => void
  className?: string
}

export function TimeField({ value, onChange, className = "" }: TimeFieldProps) {
  const [hours, setHours] = useState<string>(value.hours.toString().padStart(2, "0"))
  const [minutes, setMinutes] = useState<string>(value.minutes.toString().padStart(2, "0"))

  useEffect(() => {
    setHours(value.hours.toString().padStart(2, "0"))
    setMinutes(value.minutes.toString().padStart(2, "0"))
  }, [value])

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHours = e.target.value
    if (newHours === "" || /^\d{1,2}$/.test(newHours)) {
      setHours(newHours)

      const hoursNum = newHours === "" ? 0 : Number.parseInt(newHours, 10)
      if (hoursNum >= 0 && hoursNum <= 23) {
        onChange({ hours: hoursNum, minutes: value.minutes })
      }
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMinutes = e.target.value
    if (newMinutes === "" || /^\d{1,2}$/.test(newMinutes)) {
      setMinutes(newMinutes)

      const minutesNum = newMinutes === "" ? 0 : Number.parseInt(newMinutes, 10)
      if (minutesNum >= 0 && minutesNum <= 59) {
        onChange({ hours: value.hours, minutes: minutesNum })
      }
    }
  }

  const handleBlur = () => {
    setHours(value.hours.toString().padStart(2, "0"))
    setMinutes(value.minutes.toString().padStart(2, "0"))
  }

  return (
    <div className={`flex items-center border rounded-md ${className}`}>
      <Input
        type="text"
        value={hours}
        onChange={handleHoursChange}
        onBlur={handleBlur}
        className="w-12 text-center border-0 rounded-none"
        maxLength={2}
        placeholder="HH"
      />
      <span className="mx-1">:</span>
      <Input
        type="text"
        value={minutes}
        onChange={handleMinutesChange}
        onBlur={handleBlur}
        className="w-12 text-center border-0 rounded-none"
        maxLength={2}
        placeholder="MM"
      />
    </div>
  )
}
