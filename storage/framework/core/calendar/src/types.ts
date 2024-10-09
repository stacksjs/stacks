import type { Ref } from 'vue'

export interface CalendarStore {
  day: number
  month: Ref<number>
  year: Ref<number>
  currentMonthYear: Ref<string>
  currentMonthDayYear: Ref<string>
  datesOfThePastMonth: Ref<number[]>
  datesOfTheMonth: Ref<number[]>
  datesOfNextMonth: Ref<number[]>
  currentWeekView: Ref<number[]>
  currentWeekViewToday: Ref<number[]>
}

export interface Time {
  from: string
  to: string
}
export interface Events {
  date: string
  title: string
  description: string
  month: number
  day: number
  year: number
  time: Time
}

export interface WeekDates {
  month: number
  date: number
}

export interface TimeTableStyle {
  time: string
  gridRow: string
}
export interface CalendarLink {
  from: Date
  to: Date
  allDay: boolean
  address: string
  title: string
  description: string
  timezone: string
}
