export function TimeSlotGrid({
  slots = [],
  selectedSlot,
  onSelect,
  emptyMessage = 'No active slots available for this date.',
}) {
  if (!slots.length) return <div className="text-muted small">{emptyMessage}</div>

  return (
    <div className="slot-grid">
      {slots.map((slot) => {
        const remaining = Number(slot.maxBookings || 0) - Number(slot.currentBookings || 0)
        return (
          <button
            key={slot.availabilityId}
            type="button"
            className={`slot-btn ${selectedSlot?.availabilityId === slot.availabilityId ? 'selected' : ''}`}
            onClick={() => onSelect?.(slot)}
          >
            <div>{slot.timeSlot}</div>
            <span className="slot-avail">{remaining} slot{remaining === 1 ? '' : 's'} left</span>
          </button>
        )
      })}
    </div>
  )
}
