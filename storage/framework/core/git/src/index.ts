// export * as changelog from 'changelogen'

// interface UseGitHub {
//   getTimeDifference: (givenDateString: string) => string
//   formatDuration: (durationInSeconds: number) => string
//   getActionRunDuration: (startTime: Date, endTime: Date) => string
// }

// export function useGitHub(): UseGitHub {
//   function getTimeDifference(givenDateString: string): string {
//     // Convert the given date string to a Date object
//     const givenDate: Date = new Date(givenDateString)

//     // Get the current date and time
//     const currentDate: Date = new Date()

//     // Calculate the time difference in milliseconds
//     const timeDifference: number = currentDate.getTime() - givenDate.getTime()

//     // Calculate the difference in seconds, minutes, hours, and days
//     const secondsDifference: number = Math.floor(timeDifference / 1000)
//     const minutesDifference: number = Math.floor(secondsDifference / 60)
//     const hoursDifference: number = Math.floor(minutesDifference / 60)
//     const daysDifference: number = Math.floor(hoursDifference / 24)
//     const weeksDifference: number = Math.floor(daysDifference / 7)

//     if (secondsDifference < 60) {
//       // If less than 60 seconds, return seconds only
//       return `${secondsDifference}s`
//     }

//     if (minutesDifference < 60) {
//       // If less than 60 minutes, return minutes and remaining seconds
//       const remainingSeconds = secondsDifference % 60
//       return `${minutesDifference}m ${remainingSeconds}s`
//     }

//     if (hoursDifference < 24) {
//       // If less than 24 hours, return hours and remaining minutes
//       const remainingMinutes = minutesDifference % 60
//       return `${hoursDifference}h ${remainingMinutes}m`
//     }

//     if (weeksDifference < 7) {
//       const remainingHours: number = hoursDifference % 24

//       return `${daysDifference}d ${remainingHours}h`
//     }

//     return `${weeksDifference}w`
//   }

//   function formatDuration(durationInSeconds: number): string {
//     const minutes = Math.floor(durationInSeconds / 60)
//     const seconds = durationInSeconds % 60

//     if (minutes > 1)
//       return `${minutes}m ${seconds}s`

//     return `${seconds}s`
//   }

//   function getActionRunDuration(startTime: Date, endTime: Date): string {
//     const start = new Date(startTime)
//     const end = new Date(endTime)
//     const durationInSeconds = Math.floor((end.getTime() - start.getTime()) / 1000)

//     return formatDuration(durationInSeconds)
//   }

//   return { getTimeDifference, formatDuration, getActionRunDuration }
// }
