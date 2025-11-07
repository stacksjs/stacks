console.log('=== JAVASCRIPT STARTING ===')

// Global variables
let taskbarContextMenu: HTMLElement | null = null
let taskbarContextWindowId: string | null = null

// Login System
const loginScreen = document.getElementById('login-screen')
const emailLoginForm = document.getElementById('email-login-form')
const licenseLoginForm = document.getElementById('license-login-form')

// Show login screen when Login app is clicked
function showLoginScreen() {
  if (loginScreen)
    loginScreen.classList.remove('hidden')
}

// Show email login form
const emailLoginBtn = document.getElementById('email-login-btn')
if (emailLoginBtn) {
  emailLoginBtn.addEventListener('click', () => {
    if (loginScreen)
      loginScreen.classList.add('hidden')
    if (emailLoginForm)
      emailLoginForm.classList.remove('hidden')
    // Focus email input
    setTimeout(() => {
      const emailInput = document.getElementById('email-input') as HTMLInputElement
      if (emailInput)
        emailInput.focus()
    }, 100)
  })
}

// Show license login form
const licenseLoginBtn = document.getElementById('license-login-btn')
if (licenseLoginBtn) {
  licenseLoginBtn.addEventListener('click', () => {
    if (loginScreen)
      loginScreen.classList.add('hidden')
    if (licenseLoginForm)
      licenseLoginForm.classList.remove('hidden')
    // Focus license input
    setTimeout(() => {
      const licenseInput = document.getElementById('license-input') as HTMLInputElement
      if (licenseInput)
        licenseInput.focus()
    }, 100)
  })
}

// Hide login forms and show user selection
function hideLoginForms() {
  if (emailLoginForm)
    emailLoginForm.classList.add('hidden')
  if (licenseLoginForm)
    licenseLoginForm.classList.add('hidden')
  if (loginScreen)
    loginScreen.classList.remove('hidden')
}

// Close login screens
function closeLoginScreens() {
  if (loginScreen)
    loginScreen.classList.add('hidden')
  if (emailLoginForm)
    emailLoginForm.classList.add('hidden')
  if (licenseLoginForm)
    licenseLoginForm.classList.add('hidden')
}

// Handle email/password login
function handleEmailLogin() {
  const emailInput = document.getElementById('email-input') as HTMLInputElement
  const passwordInput = document.getElementById('password-input') as HTMLInputElement

  const email = emailInput?.value.trim()
  const password = passwordInput?.value.trim()

  if (!email || !password) {
    alert('Please enter both email and password')
    return
  }

  // For demo purposes, accept any non-empty credentials
  // In production, this would validate against a backend
  console.log('Email login successful:', email)
  alert(`Login successful! Welcome ${email}`)

  // Close login screens
  closeLoginScreens()

  // Clear form
  emailInput.value = ''
  passwordInput.value = ''
}

// Handle license key login
function handleLicenseLogin() {
  const licenseInput = document.getElementById('license-input') as HTMLInputElement
  const licenseKey = licenseInput?.value.trim()

  if (!licenseKey) {
    alert('Please enter a license key')
    return
  }

  // For demo purposes, accept any non-empty license key
  // In production, this would validate against a backend
  console.log('License login successful:', licenseKey)
  alert(`License key activated successfully!`)

  // Close login screens
  closeLoginScreens()

  // Clear form
  licenseInput.value = ''
}

// Make functions available globally for onclick handlers
(window as any).showLoginScreen = showLoginScreen;
(window as any).hideLoginForms = hideLoginForms;
(window as any).closeLoginScreens = closeLoginScreens;
(window as any).handleEmailLogin = handleEmailLogin;
(window as any).handleLicenseLogin = handleLicenseLogin

// Enter key handlers for login forms
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email-input')
  const passwordInput = document.getElementById('password-input')
  const licenseInput = document.getElementById('license-input')

  if (emailInput || passwordInput) {
    [emailInput, passwordInput].forEach((input) => {
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleEmailLogin()
        }
      })
    })
  }

  if (licenseInput) {
    licenseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleLicenseLogin()
      }
    })
  }
})

// Clock
function updateClock() {
  const now = new Date()
  const hours = now.getHours() % 12 || 12
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  const month = now.getMonth() + 1
  const day = now.getDate()
  const year = now.getFullYear()
  const clockElement = document.getElementById('clock')
  if (clockElement) {
    clockElement.textContent = `${hours}:${minutes} ${ampm} ${month}/${day}/${year}`
  }
}
updateClock()
setInterval(updateClock, 1000) // Update every second

// Desktop Icon Positioning and Dragging
let draggedIcon: HTMLElement | null = null
const iconDragOffset = { x: 0, y: 0 }
let iconDragStartX = 0
let iconDragStartY = 0
let iconDragThresholdMet = false
let hasMove = false
let selectedIcon: HTMLElement | null = null
let activeEditInput: HTMLInputElement | null = null
let activeEditLabel: HTMLElement | null = null
let activeEditOriginalName: string = ''
const DRAG_THRESHOLD = 5 // pixels to move before drag starts

// Grid settings for icon snapping
const GRID_SIZE = 120 // spacing between icons
const GRID_OFFSET = 20 // offset from edge

// Background images collection
const BACKGROUND_IMAGES = [
  'bg-img.png', // Original
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80', // Mountain landscape
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80', // Mountain peaks
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', // Foggy forest
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80', // Nature path
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80', // Lake and mountains
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80', // Rolling hills
  'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80', // Tropical beach
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80', // Ocean waves
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80', // Beach sunset
]
let currentBackgroundIndex = 0

// Selection rectangle
let selectionRect: HTMLElement | null = null
let isSelecting = false
let selectionStartX = 0
let selectionStartY = 0

// Check if a grid position is occupied by another icon
function isGridPositionOccupied(x: number, y: number, excludeIcon?: HTMLElement): boolean {
  const icons = document.querySelectorAll('.desktop-icon')
  const tolerance = 10 // pixels of tolerance for position comparison

  for (const icon of icons) {
    if (excludeIcon && icon === excludeIcon)
      continue

    const iconX = Number.parseInt((icon as HTMLElement).style.left || '0')
    const iconY = Number.parseInt((icon as HTMLElement).style.top || '0')

    if (Math.abs(iconX - x) < tolerance && Math.abs(iconY - y) < tolerance) {
      return true
    }
  }

  return false
}

// Find next available grid position
function findNextAvailableGridPosition(startX: number, startY: number, excludeIcon?: HTMLElement): { x: number, y: number } {
  const startCol = Math.round((startX - GRID_OFFSET) / GRID_SIZE)
  const startRow = Math.round((startY - GRID_OFFSET) / GRID_SIZE)

  // Search in a spiral pattern from the starting position
  const maxSearch = 100 // Maximum positions to check

  for (let distance = 0; distance < maxSearch; distance++) {
    // Try positions at increasing distances from the start
    for (let rowOffset = -distance; rowOffset <= distance; rowOffset++) {
      for (let colOffset = -distance; colOffset <= distance; colOffset++) {
        // Only check positions on the perimeter of the current distance
        if (Math.abs(rowOffset) !== distance && Math.abs(colOffset) !== distance) {
          continue
        }

        const col = startCol + colOffset
        const row = startRow + rowOffset

        // Skip negative positions
        if (col < 0 || row < 0)
          continue

        const x = col * GRID_SIZE + GRID_OFFSET
        const y = row * GRID_SIZE + GRID_OFFSET

        if (!isGridPositionOccupied(x, y, excludeIcon)) {
          return { x, y }
        }
      }
    }
  }

  // Fallback to original position if no space found
  return { x: startX, y: startY }
}

// Snap icon to grid
function snapToGrid(x: number, y: number, icon?: HTMLElement): { x: number, y: number } {
  const col = Math.round((x - GRID_OFFSET) / GRID_SIZE)
  const row = Math.round((y - GRID_OFFSET) / GRID_SIZE)

  const targetX = col * GRID_SIZE + GRID_OFFSET
  const targetY = row * GRID_SIZE + GRID_OFFSET

  // Check if target position is occupied
  if (isGridPositionOccupied(targetX, targetY, icon)) {
    // Find next available position
    return findNextAvailableGridPosition(targetX, targetY, icon)
  }

  return { x: targetX, y: targetY }
}

// Initialize icons when DOM is ready
function initializeIcons() {
  // Position icons initially in a grid
  const icons = document.querySelectorAll('.desktop-icon')
  console.log('Positioning', icons.length, 'icons')

  icons.forEach((icon, index) => {
    const row = Math.floor(index / 6)
    const col = index % 6
    const left = col * GRID_SIZE + GRID_OFFSET
    const top = row * GRID_SIZE + GRID_OFFSET;
    (icon as HTMLElement).style.left = `${left}px`;
    (icon as HTMLElement).style.top = `${top}px`
    console.log(`Icon ${index} positioned at (${left}, ${top})`)
  })

  // Deselect icons when clicking desktop
  const desktopIcons = document.querySelector('.desktop-icons')
  desktopIcons?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('desktop-icons')) {
      // Exit edit mode if active
      exitEditMode()

      if (selectedIcon) {
        selectedIcon.classList.remove('selected')
        selectedIcon = null
      }
    }
  })

  // Desktop selection rectangle
  desktopIcons?.addEventListener('mousedown', (e) => {
    const event = e as MouseEvent
    // Only start selection if clicking directly on desktop (not on icon)
    if ((event.target as HTMLElement).classList.contains('desktop-icons')) {
      isSelecting = true
      const rect = desktopIcons.getBoundingClientRect()
      selectionStartX = event.clientX - rect.left
      selectionStartY = event.clientY - rect.top

      // Clear previous selections
      document.querySelectorAll('.desktop-icon.selected').forEach((icon) => {
        icon.classList.remove('selected')
      })
      selectedIcon = null

      // Create selection rectangle
      if (!selectionRect) {
        selectionRect = document.createElement('div')
        selectionRect.className = 'selection-rectangle'
        desktopIcons.appendChild(selectionRect)
      }

      selectionRect.style.left = `${selectionStartX}px`
      selectionRect.style.top = `${selectionStartY}px`
      selectionRect.style.width = '0px'
      selectionRect.style.height = '0px'
      selectionRect.style.display = 'block'

      event.preventDefault()
    }
  })

  document.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionRect || !desktopIcons)
      return

    const rect = desktopIcons.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    const left = Math.min(selectionStartX, currentX)
    const top = Math.min(selectionStartY, currentY)
    const width = Math.abs(currentX - selectionStartX)
    const height = Math.abs(currentY - selectionStartY)

    selectionRect.style.left = `${left}px`
    selectionRect.style.top = `${top}px`
    selectionRect.style.width = `${width}px`
    selectionRect.style.height = `${height}px`

    // Check which icons are in the selection
    const selectionRectBounds = {
      left,
      top,
      right: left + width,
      bottom: top + height,
    }

    document.querySelectorAll('.desktop-icon').forEach((icon) => {
      const iconEl = icon as HTMLElement
      const iconLeft = Number.parseFloat(iconEl.style.left || '0')
      const iconTop = Number.parseFloat(iconEl.style.top || '0')
      const iconRight = iconLeft + iconEl.offsetWidth
      const iconBottom = iconTop + iconEl.offsetHeight

      // Check if icon intersects with selection rectangle
      const intersects = !(
        iconRight < selectionRectBounds.left
        || iconLeft > selectionRectBounds.right
        || iconBottom < selectionRectBounds.top
        || iconTop > selectionRectBounds.bottom
      )

      if (intersects) {
        iconEl.classList.add('selected')
      }
      else {
        iconEl.classList.remove('selected')
      }
    })
  })

  document.addEventListener('mouseup', () => {
    if (isSelecting && selectionRect) {
      isSelecting = false
      selectionRect.style.display = 'none'

      // Update selectedIcon to last selected if any
      const selected = document.querySelectorAll('.desktop-icon.selected')
      if (selected.length > 0) {
        selectedIcon = selected[selected.length - 1] as HTMLElement
      }
    }
  })

  // Desktop Icon Clicks and Drag
  document.querySelectorAll('.desktop-icon').forEach((icon) => {
    let clickTimeout: number
    let _clickCount = 0

    icon.addEventListener('mousedown', (e) => {
      const event = e as MouseEvent
      // Don't start drag if clicking on label input
      if ((event.target as HTMLElement).tagName === 'INPUT')
        return

      if ((event.target as HTMLElement).closest('.desktop-icon-label') || (event.target as HTMLElement).closest('.desktop-icon-image')) {
        draggedIcon = icon as HTMLElement
        hasMove = false
        iconDragThresholdMet = false
        iconDragStartX = event.clientX
        iconDragStartY = event.clientY

        const rect = icon.getBoundingClientRect()
        iconDragOffset.x = event.clientX - rect.left
        iconDragOffset.y = event.clientY - rect.top

        event.preventDefault()
      }
    })

    icon.addEventListener('click', (e) => {
      const event = e as MouseEvent
      if (hasMove)
        return // Don't trigger click if we were dragging
      if ((event.target as HTMLElement).tagName === 'INPUT')
        return // Don't interfere with input editing

      clearTimeout(clickTimeout)
      _clickCount++

      // Immediately show selection on first click
      const wasAlreadySelected = selectedIcon === icon && icon.classList.contains('selected')

      // Exit edit mode if clicking on a different icon
      if (selectedIcon && selectedIcon !== icon) {
        exitEditMode()
        selectedIcon.classList.remove('selected')
      }

      icon.classList.add('selected')
      selectedIcon = icon as HTMLElement

      // If clicking on an already selected icon, enter edit mode after short delay
      if (wasAlreadySelected) {
        clickTimeout = window.setTimeout(() => {
          enterEditMode(icon as HTMLElement)
          _clickCount = 0
        }, 500)
      }
      else {
      // Set timeout to reset click count
        clickTimeout = window.setTimeout(() => {
          _clickCount = 0
        }, 250)
      }
    })

    icon.addEventListener('dblclick', (e) => {
      const event = e as MouseEvent
      clearTimeout(clickTimeout)
      _clickCount = 0
      event.preventDefault()

      // Double click - open
      const type = (icon as HTMLElement).dataset.iconType
      const section = (icon as HTMLElement).dataset.iconSection
      const url = (icon as HTMLElement).dataset.iconUrl

      if (type === 'window' && section) {
        openWindow(section)
      }
      else if (type === 'link' && url) {
        window.open(url, '_blank')
      }
    })
  })

  // Icon drag move
  document.addEventListener('mousemove', (e) => {
    if (!draggedIcon)
      return

    // Check if we've moved enough to start dragging
    if (!iconDragThresholdMet) {
      const deltaX = Math.abs(e.clientX - iconDragStartX)
      const deltaY = Math.abs(e.clientY - iconDragStartY)

      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        iconDragThresholdMet = true
        hasMove = true
      }
      else {
        return // Don't drag yet, threshold not met
      }
    }

    hasMove = true

    const desktopIcons = document.querySelector('.desktop-icons')
    if (!desktopIcons)
      return
    const desktopRect = desktopIcons.getBoundingClientRect()

    const x = e.clientX - desktopRect.left - iconDragOffset.x
    const y = e.clientY - desktopRect.top - iconDragOffset.y

    draggedIcon.style.left = `${Math.max(0, Math.min(x, desktopRect.width - 100))}px`
    draggedIcon.style.top = `${Math.max(0, Math.min(y, desktopRect.height - 100))}px`
  })

  // Icon drag end
  document.addEventListener('mouseup', () => {
    if (draggedIcon) {
      // Snap to grid if icon was moved
      if (iconDragThresholdMet || hasMove) {
        const currentX = Number.parseInt(draggedIcon.style.left || '0')
        const currentY = Number.parseInt(draggedIcon.style.top || '0')

        const snapped = snapToGrid(currentX, currentY, draggedIcon)

        draggedIcon.style.left = `${snapped.x}px`
        draggedIcon.style.top = `${snapped.y}px`
      }

      // Reset drag state immediately (not in timeout)
      draggedIcon = null
      iconDragThresholdMet = false

      // Only delay hasMove reset to prevent click after drag
      setTimeout(() => {
        hasMove = false
      }, 100)
    }
  })
}

// Call initialization when DOM is ready
// window management
let activewindow = null
let windowZIndex = 100

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeIcons()
    initializeWindowDragging()
    // Set the welcome window as active initially
    activewindow = document.getElementById('window-welcome')
    // Update taskbar to show welcome window
    updateTaskbar()
  })
}
else {
  initializeIcons()
  initializeWindowDragging()
  // Set the welcome window as active initially
  activewindow = document.getElementById('window-welcome')
  // Update taskbar to show welcome window
  updateTaskbar()
}

function openWindow(windowId, fromTaskbarButton = null) {
  console.log('Opening window:', windowId)
  const windowEl = document.getElementById(`window-${windowId}`)
  if (!windowEl) {
    console.warn('window not found:', windowId)
    return
  }

  // Check if window was previously minimized
  const wasMinimized = windowEl.classList.contains('minimized')

  if (wasMinimized) {
    // If restoring from minimized, let the taskbar handler do the animation
    windowEl.classList.remove('minimized')
  }

  // Add a smooth entry animation for first-time opens
  if (!wasMinimized && !windowEl.classList.contains('active')) {
    // If opened from a specific location (like taskbar), animate from there
    if (fromTaskbarButton) {
      // Make window visible but transparent to get correct position
      windowEl.classList.add('restoring')
      windowEl.style.opacity = '0'
      windowEl.style.visibility = 'visible'

      // Force reflow to get actual position
      void windowEl.offsetHeight

      const buttonRect = fromTaskbarButton.getBoundingClientRect()
      const windowRect = windowEl.getBoundingClientRect()
      const windowCenterX = windowRect.left + windowRect.width / 2
      const windowCenterY = windowRect.top + windowRect.height / 2
      const buttonCenterX = buttonRect.left + buttonRect.width / 2
      const buttonCenterY = buttonRect.top + buttonRect.height / 2

      const translateX = buttonCenterX - windowCenterX
      const translateY = buttonCenterY - windowCenterY

      // Start from button position
      windowEl.style.transition = 'none'
      windowEl.style.transformOrigin = 'center center'
      windowEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.1)`
      windowEl.style.opacity = '0'
      windowEl.style.zIndex = ++windowZIndex
      activewindow = windowEl

      // Force reflow
      void windowEl.offsetHeight

      // Animate to window position
      requestAnimationFrame(() => {
        windowEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
        windowEl.style.transform = 'translate(0, 0) scale(1)'
        windowEl.style.opacity = '1'

        setTimeout(() => {
          windowEl.classList.remove('restoring')
          windowEl.classList.add('active')
          windowEl.style.transition = ''
          windowEl.style.transform = ''
          windowEl.style.opacity = ''
          windowEl.style.visibility = ''
          windowEl.style.transformOrigin = ''
          updateTaskbar()
        }, 200)
      })
    }
    else {
      // Simple fade-in for regular opens
      windowEl.style.opacity = '0'
      windowEl.style.transform = 'scale(0.95)'
      windowEl.classList.add('active')
      windowEl.style.zIndex = ++windowZIndex
      activewindow = windowEl

      // Trigger animation
      requestAnimationFrame(() => {
        windowEl.style.transition = 'opacity 0.15s ease, transform 0.15s ease'
        windowEl.style.opacity = '1'
        windowEl.style.transform = 'scale(1)'

        setTimeout(() => {
          windowEl.style.transition = ''
          windowEl.style.transform = ''
          windowEl.style.opacity = ''
        }, 150)
      })
    }
  }
  else {
    windowEl.classList.add('active')
    windowEl.style.zIndex = ++windowZIndex
    activewindow = windowEl
  }

  if (!fromTaskbarButton) {
    updateTaskbar()
  }
}

function closeWindow(windowId) {
  console.log('Closing window:', windowId)
  const windowEl = document.getElementById(`window-${windowId}`)
  if (!windowEl)
    return

  windowEl.classList.remove('active', 'minimized', 'maximized')
  if (activewindow === windowEl) {
    activewindow = null
  }

  updateTaskbar()

  // Show notification when welcome window is closed
  if (windowId === 'welcome') {
    showNotification()
  }
}

function minimizeWindow(windowId) {
  console.log('Minimizing window:', windowId)
  const windowEl = document.getElementById(`window-${windowId}`)
  if (!windowEl)
    return

  // Remove active, add minimizing to keep visible
  windowEl.classList.remove('active')
  windowEl.classList.add('minimizing')

  // Update taskbar first
  updateTaskbar()

  // Find the taskbar button for this window after a small delay
  requestAnimationFrame(() => {
    const taskbarButtons = document.querySelectorAll('.taskbar-task')
    let targetButton = null
    taskbarButtons.forEach((btn) => {
      const btnText = btn.querySelector('.taskbar-task-label')?.textContent
      const windowTitle = windowEl.querySelector('.window-title')?.textContent
      if (btnText === windowTitle) {
        targetButton = btn
      }
    })

    if (targetButton) {
      // Get positions
      const windowRect = windowEl.getBoundingClientRect()
      const buttonRect = targetButton.getBoundingClientRect()

      // Calculate translation to button center (from window center)
      const windowCenterX = windowRect.left + windowRect.width / 2
      const windowCenterY = windowRect.top + windowRect.height / 2
      const buttonCenterX = buttonRect.left + buttonRect.width / 2
      const buttonCenterY = buttonRect.top + buttonRect.height / 2

      const translateX = buttonCenterX - windowCenterX
      const translateY = buttonCenterY - windowCenterY

      // Set initial state (current position)
      windowEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
      windowEl.style.transformOrigin = 'center center'
      windowEl.style.transform = 'translate(0, 0) scale(1)'
      windowEl.style.opacity = '1'

      // Force reflow
      void windowEl.offsetHeight

      // Animate to taskbar button center
      windowEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.1)`
      windowEl.style.opacity = '0'

      // After animation completes, hide window
      setTimeout(() => {
        windowEl.classList.remove('minimizing')
        windowEl.classList.add('minimized')
        windowEl.style.transition = ''
        windowEl.style.transform = ''
        windowEl.style.opacity = ''
        windowEl.style.transformOrigin = ''
      }, 200)
    }
    else {
      // Fallback - just fade out
      windowEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
      windowEl.style.opacity = '1'
      void windowEl.offsetHeight
      windowEl.style.opacity = '0'
      windowEl.style.transform = 'scale(0.8)'

      setTimeout(() => {
        windowEl.classList.remove('minimizing')
        windowEl.classList.add('minimized')
        windowEl.style.transition = ''
        windowEl.style.transform = ''
        windowEl.style.opacity = ''
        windowEl.style.transformOrigin = ''
      }, 200)
    }
  })

  // Show notification when welcome window is minimized
  if (windowId === 'welcome') {
    showNotification()
  }
}

function toggleMaximizeWindow(windowId) {
  console.log('Toggling maximize for window:', windowId)
  const windowEl = document.getElementById(`window-${windowId}`)
  if (!windowEl)
    return

  // Store original position and size before maximizing
  if (!windowEl.classList.contains('maximized')) {
    windowEl.dataset.originalLeft = windowEl.style.left
    windowEl.dataset.originalTop = windowEl.style.top
    windowEl.dataset.originalWidth = windowEl.style.width
    windowEl.dataset.originalHeight = windowEl.style.height
  }

  windowEl.classList.toggle('maximized')

  // Restore original position if unmaximizing
  if (!windowEl.classList.contains('maximized')) {
    if (windowEl.dataset.originalLeft)
      windowEl.style.left = windowEl.dataset.originalLeft
    if (windowEl.dataset.originalTop)
      windowEl.style.top = windowEl.dataset.originalTop
    if (windowEl.dataset.originalWidth)
      windowEl.style.width = windowEl.dataset.originalWidth
    if (windowEl.dataset.originalHeight)
      windowEl.style.height = windowEl.dataset.originalHeight
  }
}

function updateTaskbar() {
  const taskbarTasks = document.getElementById('taskbar-tasks')
  taskbarTasks.innerHTML = ''

  const windows = document.querySelectorAll('.window')
  windows.forEach((windowEl) => {
    const isOpen = windowEl.classList.contains('active')
      || windowEl.classList.contains('minimized')
      || windowEl.classList.contains('minimizing')
      || windowEl.classList.contains('restoring')
    if (!isOpen)
      return

    const windowId = windowEl.id.replace('window-', '')
    const icon = windowEl.querySelector('.window-icon').textContent
    const title = windowEl.querySelector('.window-title').textContent
    const isActive = windowEl.classList.contains('active') || windowEl.classList.contains('restoring')

    const taskBtn = document.createElement('button')
    taskBtn.className = `taskbar-task${isActive ? ' active' : ''}`
    taskBtn.innerHTML = `
      <div class="taskbar-task-icon">${icon}</div>
      <div class="taskbar-task-label">${title}</div>
    `

    taskBtn.addEventListener('click', () => {
      if (windowEl.classList.contains('minimized')) {
        // Remove minimized and add restoring
        windowEl.classList.remove('minimized')
        windowEl.classList.add('restoring')
        windowEl.style.zIndex = ++windowZIndex

        // Get button and window centers
        const buttonRect = taskBtn.getBoundingClientRect()
        const windowRect = windowEl.getBoundingClientRect()
        const windowCenterX = windowRect.left + windowRect.width / 2
        const windowCenterY = windowRect.top + windowRect.height / 2
        const buttonCenterX = buttonRect.left + buttonRect.width / 2
        const buttonCenterY = buttonRect.top + buttonRect.height / 2

        const translateX = buttonCenterX - windowCenterX
        const translateY = buttonCenterY - windowCenterY

        // Start from button position (no transition yet)
        windowEl.style.transition = 'none'
        windowEl.style.transformOrigin = 'center center'
        windowEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.1)`
        windowEl.style.opacity = '0'

        // Force reflow
        void windowEl.offsetHeight

        // Enable transitions and animate to window position
        requestAnimationFrame(() => {
          windowEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
          windowEl.style.transform = 'translate(0, 0) scale(1)'
          windowEl.style.opacity = '1'

          // After animation, clean up
          setTimeout(() => {
            windowEl.classList.remove('restoring')
            windowEl.classList.add('active')
            windowEl.style.transition = ''
            windowEl.style.transform = ''
            windowEl.style.opacity = ''
            windowEl.style.transformOrigin = ''
            activewindow = windowEl
            updateTaskbar()
          }, 200)
        })
      }
      else if (windowEl.classList.contains('active')) {
        minimizeWindow(windowId)
      }
      else {
        windowEl.classList.add('active')
        windowEl.style.zIndex = ++windowZIndex
        activewindow = windowEl
        updateTaskbar()
      }
    })

    // Right-click context menu for taskbar buttons
    taskBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showTaskbarContextMenu(e, windowId, windowEl)
    })

    taskbarTasks.appendChild(taskBtn)
  })
}

// Keyboard shortcuts for window management
document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Escape key to close active window
  if (e.key === 'Escape' || e.key === 'Esc') {
    const openWindow = document.querySelector('.window.active:not(.minimized)')

    if (openWindow) {
      e.preventDefault()
      const windowId = openWindow.id.replace('window-', '')
      closeWindow(windowId)
    }
  }
})

// window dragging
let draggedwindow = null
let dragOffsetX = 0
let dragOffsetY = 0

function initializeWindowDragging() {
  document.querySelectorAll('.window').forEach((windowEl) => {
    const titlebar = windowEl.querySelector('.window-titlebar')

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('window-control'))
        return
      if (windowEl.classList.contains('maximized'))
        return

      draggedwindow = windowEl
      dragOffsetX = e.clientX - windowEl.offsetLeft
      dragOffsetY = e.clientY - windowEl.offsetTop

      windowEl.style.zIndex = ++windowZIndex
      windowEl.classList.add('active')
      activewindow = windowEl

      updateTaskbar()
    })
  })

  document.addEventListener('mousemove', (e) => {
    if (!draggedwindow)
      return

    const newX = e.clientX - dragOffsetX
    const newY = e.clientY - dragOffsetY

    draggedwindow.style.left = `${newX}px`
    draggedwindow.style.top = `${newY}px`
  })

  document.addEventListener('mouseup', () => {
    draggedwindow = null
  })
}

// Feature switching
const featureContent = {
  backend: {
    auth: {
      title: 'Authentication',
      code: `import { Auth } from '@stacksjs/auth'

// Login user
const user = await Auth.attempt({
  email: 'user@example.com',
  password: 'secret'
})

// Get authenticated user
const current = await Auth.user()`,
    },
    orm: {
      title: 'ORM',
      code: `import { User } from './models/User'

// Eloquent-style queries
const users = await User.where('active', true)
  .orderBy('created_at', 'desc')
  .limit(10)
  .get()

// Create new records
await User.create({
  name: 'John Doe',
  email: 'john@example.com'
})`,
    },
    validation: {
      title: 'Validation',
      code: `import { validate } from '@stacksjs/validation'

const result = await validate(request.body, {
  email: 'required|email',
  password: 'required|min:8',
  age: 'numeric|min:18'
})

if (result.fails()) {
  return result.errors()
}`,
    },
    storage: {
      title: 'Storage',
      code: `import { Storage } from '@stacksjs/storage'

// Store file
await Storage.put('avatars/user.jpg', fileData)

// Retrieve file
const file = await Storage.get('avatars/user.jpg')

// Delete file
await Storage.delete('avatars/user.jpg')`,
    },
    queue: {
      title: 'Queues',
      code: `import { Queue } from '@stacksjs/queue'

// Dispatch job
await Queue.dispatch('SendEmail', {
  to: 'user@example.com',
  subject: 'Welcome!'
})

// Process jobs
Queue.process('SendEmail', async (job) => {
  await sendEmail(job.data)
})`,
    },
    events: {
      title: 'Events',
      code: `import { Event } from '@stacksjs/events'

// Dispatch event
Event.dispatch('user.registered', { user })

// Listen for event
Event.listen('user.registered', (data) => {
  console.log('New user:', data.user)
})`,
    },
  },
  frontend: {
    'components': {
      title: 'Components',
      code: `&lt;template&gt;
  &lt;Card title="Hello"&gt;
    &lt;p&gt;Reusable components&lt;/p&gt;
  &lt;/Card&gt;
&lt;/template&gt;

&lt;script setup&gt;
// Auto-imported
&lt;/script&gt;`,
    },
    'ui-kit': {
      title: 'UI Kit',
      code: `import { Button, Input, Modal } from '@stacksjs/ui'

&lt;Button variant="primary"&gt;Click me&lt;/Button&gt;
&lt;Input placeholder="Enter text..." /&gt;
&lt;Modal title="Welcome"&gt;
  &lt;p&gt;Hello there!&lt;/p&gt;
&lt;/Modal&gt;`,
    },
    'routing': {
      title: 'Routing',
      code: `import { Router } from '@stacksjs/router'

Router.get('/', () => {
  return view('home')
})

Router.post('/api/users', async (request) => {
  const user = await User.create(request.body)
  return user
})`,
    },
    'desktop': {
      title: 'Desktop',
      code: `import { app, window } from '@stacksjs/desktop'

// Create desktop app
const win = window.create({
  title: 'My App',
  width: 800,
  height: 600
})

// Native features
app.notification('Hello from desktop!')`,
    },
  },
  cloud: {
    deployment: {
      title: 'Deployment',
      code: `export default {
  provider: 'aws',
  region: 'us-east-1',

  compute: {
    type: 'serverless',
    memory: 1024
  }
}`,
    },
    storage: {
      title: 'Storage',
      code: `export default {
  storage: {
    driver: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1'
  }
}`,
    },
    cdn: {
      title: 'CDN',
      code: `export default {
  cdn: {
    enabled: true,
    provider: 'cloudfront',
    domain: 'cdn.example.com'
  }
}`,
    },
    dns: {
      title: 'DNS',
      code: `export default {
  dns: {
    provider: 'route53',
    domain: 'example.com',
    records: [
      { type: 'A', name: '@', value: '1.2.3.4' }
    ]
  }
}`,
    },
  },
}

function showFeature(section, featureId) {
  console.log('Showing feature:', section, featureId)

  const buttons = document.querySelectorAll(`#window-${section} .feature-btn`)
  buttons.forEach(btn => btn.classList.remove('active'))
  event.target.classList.add('active')

  const content = featureContent[section][featureId]
  if (!content)
    return

  const contentEl = document.getElementById(`${section}-feature-content`)
  contentEl.innerHTML = `
    <h3>${content.title}</h3>
    <div class="code-display">${content.code}</div>
  `
}

// Start menu toggle
const startButton = document.querySelector('.start-button')
const startMenu = document.getElementById('start-menu')

startButton.addEventListener('click', (e) => {
  e.stopPropagation()
  startMenu.classList.toggle('active')
})

document.addEventListener('click', (e) => {
  if (!e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
    startMenu.classList.remove('active')
  }
})

// Notification
const notification = document.getElementById('notification-popup')

function closeNotification() {
  notification.classList.add('hidden')
}

function showNotification() {
  if (notification) {
    notification.classList.remove('hidden')
  }
}

// Email signup
async function handleEmailSignup() {
  const emailInput = document.getElementById('notification-email')
  const email = emailInput.value.trim()

  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address')
    return
  }

  try {
    const response = await fetch('https://stacksjs.org/api/newsletter/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (response.ok) {
      document.getElementById('notification-signup').style.display = 'none'
      document.getElementById('notification-success').style.display = 'block'
    }
    else {
      alert('Failed to subscribe. Please try again later.')
    }
  }
  catch (error) {
    console.error('Subscription error:', error)
    alert('Failed to subscribe. Please try again later.')
  }
}

// Context menu
const contextMenu = document.getElementById('context-menu')
const iconContextMenu = document.getElementById('icon-context-menu')
let contextMenuIcon: HTMLElement | null = null

document.addEventListener('contextmenu', (e) => {
  // Check if right-click is on a taskbar button
  const target = e.target as HTMLElement
  const isTaskbarButton = target.closest('.taskbar-task')

  // If it's a taskbar button, let its own handler deal with it
  if (isTaskbarButton) {
    return
  }

  e.preventDefault()

  // Check if right-click is on an icon
  const icon = target.closest('.desktop-icon') as HTMLElement

  // Hide both menus first
  contextMenu.style.display = 'none'
  iconContextMenu.style.display = 'none'

  // Also hide taskbar context menu
  if (taskbarContextMenu) {
    taskbarContextMenu.remove()
    taskbarContextMenu = null
  }

  if (icon) {
    // Select the icon first if it's not already selected
    if (selectedIcon && selectedIcon !== icon) {
      selectedIcon.classList.remove('selected')
    }
    icon.classList.add('selected')
    selectedIcon = icon

    // Show icon context menu
    contextMenuIcon = icon

    // Check if icon is on the right side of the screen
    const screenWidth = window.innerWidth
    const menuWidth = 200 // Approximate context menu width
    const isRightSide = e.clientX > screenWidth / 2

    // Position menu to the left if icon is on right side
    const menuLeft = isRightSide ? e.clientX - menuWidth : e.clientX

    iconContextMenu.style.left = `${menuLeft}px`
    iconContextMenu.style.top = `${e.clientY}px`
    iconContextMenu.style.display = 'flex'
  }
  else {
    // Show desktop context menu
    contextMenuIcon = null

    // Check if click is on the right side of the screen
    const screenWidth = window.innerWidth
    const menuWidth = 200 // Approximate context menu width
    const isRightSide = e.clientX > screenWidth / 2

    // Position menu to the left if on right side
    const menuLeft = isRightSide ? e.clientX - menuWidth : e.clientX

    contextMenu.style.left = `${menuLeft}px`
    contextMenu.style.top = `${e.clientY}px`
    contextMenu.style.display = 'flex'
  }
})

document.addEventListener('click', () => {
  contextMenu.style.display = 'none'
  iconContextMenu.style.display = 'none'
})

// Share functions
function shareVia(platform) {
  const url = 'https://stacksjs.org'
  const text = 'Check out Stacks - A TypeScript framework for modern development'

  switch (platform) {
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
      break
    case 'bluesky':
      window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank')
      break
    case 'linkedin':
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank')
      break
    case 'email':
      window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
      break
    case 'copy':
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copied to clipboard!')
      })
      break
  }
  contextMenu.style.display = 'none'
}

function copyLogoSVG() {
  const logoSVG = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#0831d9"/>
    <text x="50" y="65" font-family="Arial" font-size="40" font-weight="bold" fill="white" text-anchor="middle">S</text>
  </svg>`

  navigator.clipboard.writeText(logoSVG).then(() => {
    alert('Logo SVG copied to clipboard!')
  }).catch((err) => {
    console.error('Failed to copy:', err)
  })
}

function copyWordmarkSVG() {
  const wordmarkSVG = `<svg width="200" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
    <text x="10" y="35" font-family="Arial" font-size="30" font-weight="bold" fill="#0831d9">STACKS</text>
  </svg>`

  navigator.clipboard.writeText(wordmarkSVG).then(() => {
    alert('Wordmark SVG copied to clipboard!')
  }).catch((err) => {
    console.error('Failed to copy:', err)
  })
}

function changeBackgroundImage() {
  // Move to next background
  currentBackgroundIndex = (currentBackgroundIndex + 1) % BACKGROUND_IMAGES.length
  const newBackground = BACKGROUND_IMAGES[currentBackgroundIndex]

  // Get the desktop element
  const desktop = document.querySelector('.desktop') as HTMLElement
  if (desktop) {
    desktop.style.backgroundImage = `url('${newBackground}')`
  }

  // Close context menu
  const contextMenu = document.getElementById('context-menu')
  if (contextMenu) {
    contextMenu.style.display = 'none'
  }
}

function _submitContactForm(event: Event) {
  event.preventDefault()

  const nameInput = document.getElementById('contact-name') as HTMLInputElement
  const emailInput = document.getElementById('contact-email') as HTMLInputElement
  const subjectInput = document.getElementById('contact-subject') as HTMLInputElement
  const messageInput = document.getElementById('contact-message') as HTMLTextAreaElement

  const name = nameInput.value
  const email = emailInput.value
  const subject = subjectInput.value
  const _message = messageInput.value

  // Simulate form submission
  alert(`✅ Thank you, ${name}!\n\nYour message has been received. We'll get back to you at ${email} soon.\n\nSubject: ${subject}\n\nThis is a demo - in production, this would send your message to our team.`)

  // Clear form
  nameInput.value = ''
  emailInput.value = ''
  subjectInput.value = ''
  messageInput.value = ''
}

// Icon context menu functions
function openIconFromMenu() {
  if (!contextMenuIcon)
    return

  const iconType = contextMenuIcon.dataset.iconType
  const iconId = contextMenuIcon.dataset.iconId
  const iconUrl = contextMenuIcon.dataset.iconUrl

  if (iconType === 'window') {
    openWindow(iconId)
  }
  else if (iconType === 'link' && iconUrl) {
    window.open(iconUrl, '_blank')
  }
}

function exitEditMode(save: boolean = true) {
  if (!activeEditInput || !activeEditLabel)
    return

  if (save) {
    const newName = activeEditInput.value.trim()
    if (newName) {
      activeEditLabel.textContent = newName
    }
    else {
      activeEditLabel.textContent = activeEditOriginalName
    }
  }
  else {
    activeEditLabel.textContent = activeEditOriginalName
  }

  activeEditInput = null
  activeEditLabel = null
  activeEditOriginalName = ''
}

function enterEditMode(icon: HTMLElement) {
  // Exit any existing edit mode first
  exitEditMode()

  const labelElement = icon.querySelector('.desktop-icon-label') as HTMLElement
  if (!labelElement)
    return

  const currentName = labelElement.textContent || ''

  // Store edit state
  activeEditLabel = labelElement
  activeEditOriginalName = currentName

  // Create an input element
  const input = document.createElement('input')
  input.type = 'text'
  input.value = currentName
  input.style.cssText = `
    width: 100%;
    background: white;
    border: 1px solid #0066cc;
    padding: 2px 4px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
    text-align: center;
    outline: none;
  `

  activeEditInput = input

  // Replace label with input
  labelElement.textContent = ''
  labelElement.appendChild(input)
  input.focus()
  input.select()

  // Handle finish editing
  const finishEdit = () => {
    exitEditMode(true)
  }

  input.addEventListener('blur', finishEdit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      exitEditMode(true)
    }
    else if (e.key === 'Escape') {
      exitEditMode(false)
    }
  })
}

function renameIcon() {
  if (!contextMenuIcon)
    return

  const labelElement = contextMenuIcon.querySelector('.desktop-icon-label') as HTMLElement
  const currentName = labelElement.textContent || ''

  const newName = prompt('Enter new name:', currentName)
  if (newName && newName.trim()) {
    labelElement.textContent = newName.trim()
  }
}

function deleteIcon() {
  if (!contextMenuIcon)
    return

  const _iconId = contextMenuIcon.dataset.iconId
  const confirmed = confirm(`Are you sure you want to delete this icon?`)

  if (confirmed) {
    contextMenuIcon.remove()
    contextMenuIcon = null
  }
}

// License window functions
function closeLicenseWindow() {
  closeWindow('license')
}

// Payment form formatting and validation
function formatCardNumber(input: HTMLInputElement) {
  const value = input.value.replace(/\s/g, '').replace(/\D/g, '')
  const formattedValue = value.match(/.{1,4}/g)?.join(' ') || value
  input.value = formattedValue
}

function formatExpiry(input: HTMLInputElement) {
  const value = input.value.replace(/\D/g, '')

  if (value.length >= 2) {
    let month = value.substring(0, 2)
    const year = value.substring(2, 4)

    // Validate month
    const monthNum = Number.parseInt(month)
    if (monthNum > 12) {
      month = '12'
    }
    if (monthNum < 1 && month.length === 2) {
      month = '01'
    }
    if (monthNum === 0 && month.length === 2) {
      month = '01'
    }

    input.value = month + (year ? `/${year}` : '')
  }
  else {
    input.value = value
  }
}

function formatCVV(input: HTMLInputElement) {
  input.value = input.value.replace(/\D/g, '')
}

function togglePaymentSection() {
  const paymentForm = document.getElementById('payment-form')
  if (paymentForm) {
    paymentForm.style.display = paymentForm.style.display === 'none' ? 'block' : 'none'
  }
}

function validatePaymentForm(): boolean {
  const cardNumber = (document.getElementById('card-number') as HTMLInputElement)?.value.replace(/\s/g, '')
  const cardExpiry = (document.getElementById('card-expiry') as HTMLInputElement)?.value
  const cardCVV = (document.getElementById('card-cvv') as HTMLInputElement)?.value
  const cardName = (document.getElementById('card-name') as HTMLInputElement)?.value
  const billingEmail = (document.getElementById('billing-email') as HTMLInputElement)?.value
  const termsAgree = (document.getElementById('terms-agree') as HTMLInputElement)?.checked

  if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
    alert('❌ Please enter a valid card number.')
    return false
  }

  if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    alert('❌ Please enter a valid expiration date (MM/YY).')
    return false
  }

  // Validate expiry date is in the future
  const [month, year] = cardExpiry.split('/').map(num => Number.parseInt(num))
  const currentDate = new Date()
  const _currentYear = currentDate.getFullYear() % 100 // Last 2 digits of current year
  const currentMonth = currentDate.getMonth() + 1
  const fullCurrentYear = currentDate.getFullYear()

  // Check if month is valid
  if (month < 1 || month > 12) {
    alert('❌ Invalid month. Please enter a month between 01 and 12.')
    return false
  }

  // Determine if the year is meant to be 20XX or 19XX
  // Assume years 00-49 are 2000-2049, and 50-99 are 1950-1999
  let fullYear = year
  if (year >= 0 && year <= 49) {
    fullYear = 2000 + year
  }
  else if (year >= 50 && year <= 99) {
    fullYear = 1900 + year
  }

  // Check if card is expired
  if (fullYear < fullCurrentYear) {
    alert(`❌ Card expired in ${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}. Please use a valid card.`)
    return false
  }

  if (fullYear === fullCurrentYear && month < currentMonth) {
    alert(`❌ Card expired in ${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}. Please use a valid card.`)
    return false
  }

  // Warn about cards expiring too far in the future (likely a typo)
  if (fullYear > fullCurrentYear + 20) {
    alert(`❌ Expiration date seems invalid (${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}). Please check and try again.`)
    return false
  }

  if (!cardCVV || cardCVV.length < 3 || cardCVV.length > 4) {
    alert('❌ Please enter a valid CVV code (3-4 digits).')
    return false
  }

  if (!cardName || cardName.trim().length < 3) {
    alert('❌ Please enter the cardholder name.')
    return false
  }

  if (!billingEmail || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(billingEmail)) {
    alert('❌ Please enter a valid email address.')
    return false
  }

  if (!termsAgree) {
    alert('❌ Please agree to the terms and conditions to continue.')
    return false
  }

  return true
}

function purchaseLicense() {
  // Check if payment form is visible
  const paymentForm = document.getElementById('payment-form')
  const isPaymentVisible = paymentForm && paymentForm.style.display !== 'none'

  if (isPaymentVisible) {
    // Validate payment form
    if (!validatePaymentForm()) {
      return
    }

    // Get selected edition (hobby or professional)
    const selectedEdition = (window as any).selectedPlanType || 'professional'
    const editionName = selectedEdition === 'hobby' ? 'Hobby Edition' : 'Professional Edition'

    // Get selected pricing plan (monthly or lifetime)
    const selectedInterval = (document.querySelector('input[name="pricing-plan"]:checked') as HTMLInputElement)?.value
    const intervalType = selectedInterval === 'lifetime' ? 'Lifetime License' : 'Monthly Subscription'

    // Determine pricing based on edition and interval
    let planAmount: string
    if (selectedEdition === 'hobby') {
      planAmount = selectedInterval === 'lifetime' ? '$179' : '$9/month'
    }
    else {
      planAmount = selectedInterval === 'lifetime' ? '$279' : '$29/month'
    }

    // Get payment details
    const cardNumber = (document.getElementById('card-number') as HTMLInputElement)?.value
    const cardName = (document.getElementById('card-name') as HTMLInputElement)?.value
    const billingEmail = (document.getElementById('billing-email') as HTMLInputElement)?.value

    // Show processing message
    const maskedCard = `****${cardNumber.replace(/\s/g, '').slice(-4)}`
    alert(`✅ Processing payment with Stripe...\n\nEdition: ${editionName}\nPlan: ${intervalType}\nAmount: ${planAmount}\nCard: ${maskedCard}\nName: ${cardName}\nEmail: ${billingEmail}\n\nThis is a demo. In production, your payment data would be securely processed by Stripe without ever touching our servers.`)

    // Clear form and show success
    setTimeout(() => {
      const licenseCode = selectedInterval === 'lifetime'
        ? `STAC-KSJS-${selectedEdition.toUpperCase().substring(0, 4)}-LIFE-2025`
        : `STAC-KSJS-${selectedEdition.toUpperCase().substring(0, 4)}-MNTH-2025`

      const successMessage = selectedInterval === 'lifetime'
        ? `✅ Payment successful!\n\nYou now have LIFETIME access to STACKS.JS ${editionName}!\n\nYour license code has been sent to your email.\n\nLicense: ${licenseCode}\nType: Lifetime - ${editionName}\nStatus: Activated`
        : `✅ Payment successful!\n\nYour monthly subscription is now active!\n\nYou will be billed ${planAmount}. You can cancel anytime.\n\nLicense: ${licenseCode}\nType: Monthly - ${editionName}\nStatus: Active`

      alert(successMessage);

      // Clear payment form
      (document.getElementById('card-number') as HTMLInputElement).value = '';
      (document.getElementById('card-expiry') as HTMLInputElement).value = '';
      (document.getElementById('card-cvv') as HTMLInputElement).value = '';
      (document.getElementById('card-name') as HTMLInputElement).value = '';
      (document.getElementById('billing-email') as HTMLInputElement).value = '';
      (document.getElementById('terms-agree') as HTMLInputElement).checked = false

      closeWindow('license')
    }, 1000)
  }
  else {
    // Fall back to sponsorship page
    const confirmed = confirm('This will open the Stacks.js sponsorship page in a new window. Continue?')
    if (confirmed) {
      window.open('https://github.com/sponsors/chrisbbreuer', '_blank')
    }
  }
}

function activateLicense() {
  const input = document.getElementById('license-code-input') as HTMLInputElement
  const code = input.value.trim().toUpperCase()

  if (!code) {
    alert('Please enter a license code.')
    return
  }

  // Format the code with dashes if not already formatted
  const formattedCode = code.replace(/-/g, '').match(/.{1,4}/g)?.join('-') || code

  // Check for special codes
  if (formattedCode === 'OPEN-SOUR-CE4E-VER' || formattedCode === 'STAC-KSJS-FORE-VER') {
    alert(`✅ License activated successfully!\n\nThank you for using STACKS.JS Professional Edition.\n\nLicense: ${formattedCode}\nType: Professional Edition\nStatus: Activated`)
    input.value = ''
    closeWindow('license')
    return
  }

  // Check for trial code
  if (formattedCode === 'TRIAL-2025-STAC-KSJS') {
    alert(`✅ Trial license activated!\n\nYou have 30 days to evaluate STACKS.JS Professional Edition.\n\nLicense: ${formattedCode}\nType: 30-Day Trial\nStatus: Activated`)
    input.value = ''
    closeWindow('license')
    return
  }

  // Invalid code
  alert('❌ Invalid license code.\n\nPlease check your code and try again, or purchase a new license.\n\nTip: Try "OPEN-SOUR-CE4E-VER" or "TRIAL-2025-STAC-KSJS"')
}

// Ecosystem tab switching
function showEcosystemTab(tabName) {
  // Hide all tabs
  const tabs = document.querySelectorAll('.ecosystem-tab')
  tabs.forEach((tab) => {
    (tab as HTMLElement).style.display = 'none'
  })

  // Remove active class from all buttons
  const buttons = document.querySelectorAll('#window-ecosystem .feature-btn')
  buttons.forEach(btn => btn.classList.remove('active'))

  // Show selected tab
  const selectedTab = document.getElementById(`tab-${tabName}`)
  if (selectedTab) {
    selectedTab.style.display = 'block'
  }

  // Add active class to clicked button
  event.target.classList.add('active')
}

// Print Welcome PDF
function printWelcome() {
  const welcomeContent = document.querySelector('#window-welcome .window-content')
  if (!welcomeContent)
    return

  // Create a new window for printing
  const printWindow = window.open('', '', 'width=800,height=600')
  if (!printWindow)
    return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>STACKS.JS - Welcome</title>
        <style>
          body { font-family: 'Tahoma', sans-serif; margin: 0; padding: 20px; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        ${welcomeContent.innerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

// Download Welcome PDF
function downloadWelcome() {
  const welcomeContent = document.querySelector('#window-welcome .window-content')
  if (!welcomeContent)
    return

  // Create HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>STACKS.JS - Welcome</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Tahoma', sans-serif; margin: 0; padding: 20px; }
        </style>
      </head>
      <body>
        ${welcomeContent.innerHTML}
      </body>
    </html>
  `

  // Create blob and download
  const blob = new Blob([htmlContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'STACKS.JS-Welcome.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Plan selection
function selectPlan(planType: string) {
  // Minimize the Welcome window
  minimizeWindow('welcome')

  // Update License window based on selected plan
  const licenseTitle = document.querySelector('#window-license h2')
  const licenseTypeSpan = document.querySelectorAll('#window-license .license-type')
  const licensePriceSpan = document.querySelector('#window-license .license-price')

  // Update pricing in radio buttons
  const lifetimeRadioLabel = document.querySelector('input[value="lifetime"]')?.parentElement
  const monthlyRadioLabel = document.querySelector('input[value="monthly"]')?.parentElement

  // Update features list
  const featuresSpan = document.querySelector('#window-license .license-features')

  if (planType === 'hobby') {
    if (licenseTitle)
      licenseTitle.textContent = 'STACKS.JS Hobby Edition'
    licenseTypeSpan.forEach(el => el.textContent = 'Hobby Edition')
    if (licensePriceSpan)
      licensePriceSpan.textContent = '$9/mo or $179 lifetime'
    if (featuresSpan)
      featuresSpan.innerHTML = 'Unlimited Projects<br>Priority Support<br>Lifetime Updates'

    // Update radio button pricing for Hobby
    if (lifetimeRadioLabel) {
      const priceDiv = lifetimeRadioLabel.querySelector('div > div:first-child') as HTMLElement
      if (priceDiv)
        priceDiv.innerHTML = '🎉 Lifetime Access - $179'
    }
    if (monthlyRadioLabel) {
      const priceDiv = monthlyRadioLabel.querySelector('div > div:first-child') as HTMLElement
      if (priceDiv)
        priceDiv.innerHTML = 'Monthly Subscription - $9/mo'
    }
  }
  else {
    if (licenseTitle)
      licenseTitle.textContent = 'STACKS.JS Professional Edition'
    licenseTypeSpan.forEach(el => el.textContent = 'Professional Edition')
    if (licensePriceSpan)
      licensePriceSpan.textContent = '$29/mo or $279 lifetime'
    if (featuresSpan)
      featuresSpan.innerHTML = 'Unlimited Projects<br>Unlimited Team Members<br>Priority Support<br>Lifetime Updates'

    // Update radio button pricing for Professional
    if (lifetimeRadioLabel) {
      const priceDiv = lifetimeRadioLabel.querySelector('div > div:first-child') as HTMLElement
      if (priceDiv)
        priceDiv.innerHTML = '🎉 Lifetime Access - $279'
    }
    if (monthlyRadioLabel) {
      const priceDiv = monthlyRadioLabel.querySelector('div > div:first-child') as HTMLElement
      if (priceDiv)
        priceDiv.innerHTML = 'Monthly Subscription - $29/mo'
    }
  }

  // Store the selected plan type
  (window as any).selectedPlanType = planType

  // Wait for Welcome window to finish minimizing, then open License from the taskbar
  setTimeout(() => {
    // The License window will get a taskbar button, so we need to open it first
    // to create the button, then animate it
    const licenseWindow = document.getElementById('window-license')
    if (!licenseWindow)
      return

    // Temporarily mark as minimized to create taskbar button
    licenseWindow.classList.add('minimized')
    updateTaskbar()

    // Find the newly created License taskbar button
    setTimeout(() => {
      const taskbarButtons = document.querySelectorAll('.taskbar-task')
      let licenseButton = null
      taskbarButtons.forEach((btn) => {
        const btnText = btn.querySelector('.taskbar-task-label')?.textContent
        if (btnText && btnText.includes('License')) {
          licenseButton = btn
        }
      })

      // Now remove minimized and open with animation from the button
      licenseWindow.classList.remove('minimized')
      if (licenseButton) {
        openWindow('license', licenseButton)
      }
      else {
        openWindow('license')
      }
    }, 10)
  }, 250) // Wait for minimize animation to complete

  // Show notification when a plan is selected
  showNotification()
}

// Zoom functionality
let currentZoom = 100

function setZoom(zoomLevel: number) {
  // Clamp zoom between 25 and 400
  zoomLevel = Math.max(25, Math.min(400, zoomLevel))
  currentZoom = zoomLevel

  const content = document.getElementById('welcome-pdf-content')
  const zoomInput = document.getElementById('zoom-level') as HTMLInputElement

  if (content) {
    const scale = zoomLevel / 100
    content.style.transform = `scale(${scale})`
    content.style.transformOrigin = 'top center'
  }

  if (zoomInput) {
    zoomInput.value = zoomLevel.toString()
  }
}

function increaseZoom() {
  setZoom(currentZoom + 25)
}

function decreaseZoom() {
  setZoom(currentZoom - 25)
}

function setZoomFromInput() {
  const zoomInput = document.getElementById('zoom-level') as HTMLInputElement
  if (zoomInput) {
    const value = Number.parseInt(zoomInput.value)
    if (!Number.isNaN(value)) {
      setZoom(value)
    }
  }
}

// Taskbar context menu

function showTaskbarContextMenu(e: MouseEvent, windowId: string, windowEl: HTMLElement) {
  // Remove existing menu if any
  if (taskbarContextMenu) {
    taskbarContextMenu.remove()
  }

  // Hide desktop context menus
  const contextMenu = document.getElementById('context-menu')
  const iconContextMenu = document.getElementById('icon-context-menu')
  if (contextMenu)
    contextMenu.style.display = 'none'
  if (iconContextMenu)
    iconContextMenu.style.display = 'none'

  taskbarContextWindowId = windowId

  // Create context menu
  taskbarContextMenu = document.createElement('div')
  taskbarContextMenu.className = 'taskbar-context-menu'
  taskbarContextMenu.style.position = 'fixed'
  taskbarContextMenu.style.left = `${e.clientX}px`

  // Position above the taskbar
  const _menuHeight = 120 // approximate
  taskbarContextMenu.style.bottom = '45px' // Just above taskbar

  const isMinimized = windowEl.classList.contains('minimized')
  const isMaximized = windowEl.classList.contains('maximized')

  taskbarContextMenu.innerHTML = `
    <button class="context-menu-item" onclick="taskbarContextRestore()">
      <div class="context-menu-item-icon">🗗</div>
      <div>${isMinimized ? 'Restore' : 'Minimize'}</div>
    </button>
    <button class="context-menu-item" onclick="taskbarContextMaximize()" ${isMinimized ? 'disabled' : ''}>
      <div class="context-menu-item-icon">🗖</div>
      <div>${isMaximized ? 'Restore Down' : 'Maximize'}</div>
    </button>
    <div style="height: 1px; background: #ccc; margin: 4px 0;"></div>
    <button class="context-menu-item" onclick="taskbarContextClose()">
      <div class="context-menu-item-icon">✕</div>
      <div>Close</div>
    </button>
  `

  document.body.appendChild(taskbarContextMenu)

  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', closeTaskbarContextMenu)
  }, 0)
}

function closeTaskbarContextMenu() {
  if (taskbarContextMenu) {
    taskbarContextMenu.remove()
    taskbarContextMenu = null
  }
  document.removeEventListener('click', closeTaskbarContextMenu)
}

function taskbarContextRestore() {
  if (!taskbarContextWindowId)
    return
  const windowEl = document.getElementById(`window-${taskbarContextWindowId}`)
  if (!windowEl)
    return

  if (windowEl.classList.contains('minimized')) {
    // Click the taskbar button to restore
    const taskBtn = Array.from(document.querySelectorAll('.taskbar-task')).find((btn) => {
      const btnText = btn.querySelector('.taskbar-task-label')?.textContent
      const windowTitle = windowEl.querySelector('.window-title')?.textContent
      return btnText === windowTitle
    }) as HTMLElement
    if (taskBtn)
      taskBtn.click()
  }
  else {
    minimizeWindow(taskbarContextWindowId)
  }
  closeTaskbarContextMenu()
}

function taskbarContextMaximize() {
  if (!taskbarContextWindowId)
    return
  toggleMaximizeWindow(taskbarContextWindowId)
  closeTaskbarContextMenu()
}

function taskbarContextClose() {
  if (!taskbarContextWindowId)
    return
  closeWindow(taskbarContextWindowId)
  closeTaskbarContextMenu()
}

// Make functions globally accessible for inline onclick handlers
window.openWindow = openWindow
window.closeWindow = closeWindow
window.minimizeWindow = minimizeWindow
window.toggleMaximizeWindow = toggleMaximizeWindow
window.showFeature = showFeature
window.closeNotification = closeNotification
window.showNotification = showNotification
window.handleEmailSignup = handleEmailSignup
window.shareVia = shareVia
window.copyLogoSVG = copyLogoSVG
window.copyWordmarkSVG = copyWordmarkSVG
window.changeBackgroundImage = changeBackgroundImage
window.openIconFromMenu = openIconFromMenu
window.renameIcon = renameIcon
window.deleteIcon = deleteIcon
window.closeLicenseWindow = closeLicenseWindow
window.purchaseLicense = purchaseLicense
window.activateLicense = activateLicense
window.formatCardNumber = formatCardNumber
window.formatExpiry = formatExpiry
window.formatCVV = formatCVV
window.togglePaymentSection = togglePaymentSection
window.showEcosystemTab = showEcosystemTab
window.printWelcome = printWelcome
window.downloadWelcome = downloadWelcome
window.setZoom = setZoom
window.increaseZoom = increaseZoom
window.decreaseZoom = decreaseZoom
window.setZoomFromInput = setZoomFromInput
window.selectPlan = selectPlan
window.taskbarContextRestore = taskbarContextRestore
window.taskbarContextMaximize = taskbarContextMaximize
window.taskbarContextClose = taskbarContextClose
