import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

export interface UseGeolocationCoords {
  latitude: Ref<number | null>
  longitude: Ref<number | null>
  accuracy: Ref<number | null>
  altitude: Ref<number | null>
  altitudeAccuracy: Ref<number | null>
  heading: Ref<number | null>
  speed: Ref<number | null>
}

export interface UseGeolocationReturn {
  coords: UseGeolocationCoords
  locatedAt: Ref<number | null>
  error: Ref<GeolocationPositionError | null>
  isSupported: Ref<boolean>
  pause: () => void
  resume: () => void
}

/**
 * Reactive geolocation.
 * Tracks the user's geographic position using the Geolocation API.
 *
 * @param options - PositionOptions plus an immediate flag (default: true)
 * @returns Reactive coords, location timestamp, error, support status, and pause/resume controls
 */
export function useGeolocation(
  options?: PositionOptions & { immediate?: boolean },
): UseGeolocationReturn {
  const { immediate = true, ...positionOptions } = options ?? {}

  const isSupported = ref(typeof navigator !== 'undefined' && 'geolocation' in navigator)

  const coords: UseGeolocationCoords = {
    latitude: ref<number | null>(null),
    longitude: ref<number | null>(null),
    accuracy: ref<number | null>(null),
    altitude: ref<number | null>(null),
    altitudeAccuracy: ref<number | null>(null),
    heading: ref<number | null>(null),
    speed: ref<number | null>(null),
  }

  const locatedAt = ref<number | null>(null)
  const error = ref<GeolocationPositionError | null>(null)

  let watchId: number | null = null
  let cleanup = noop

  const updatePosition = (position: GeolocationPosition): void => {
    coords.latitude.value = position.coords.latitude
    coords.longitude.value = position.coords.longitude
    coords.accuracy.value = position.coords.accuracy
    coords.altitude.value = position.coords.altitude
    coords.altitudeAccuracy.value = position.coords.altitudeAccuracy
    coords.heading.value = position.coords.heading
    coords.speed.value = position.coords.speed
    locatedAt.value = position.timestamp
    error.value = null
  }

  const onError = (err: GeolocationPositionError): void => {
    error.value = err
  }

  const resume = (): void => {
    if (!isSupported.value) return
    if (watchId !== null) return

    watchId = navigator.geolocation.watchPosition(
      updatePosition,
      onError,
      positionOptions,
    )

    cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      cleanup = noop
    }
  }

  const pause = (): void => {
    cleanup()
  }

  if (immediate) {
    resume()
  }

  try {
    onUnmounted(pause)
  }
  catch {
    // Not in a component context
  }

  return {
    coords,
    locatedAt,
    error,
    isSupported,
    pause,
    resume,
  }
}
