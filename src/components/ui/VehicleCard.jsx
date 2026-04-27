export function VehicleCard({ vehicle, selected = false, onClick }) {
  return (
    <button type="button" className={`vehicle-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="veh-name">{vehicle.brand} {vehicle.model}</div>
      <div className="veh-detail-grid">
        <div className="veh-detail-block">
          <span className="veh-detail-label">Registration</span>
          <span className="veh-detail-value">{vehicle.registrationNumber}</span>
        </div>
        <div className="veh-detail-block">
          <span className="veh-detail-label">Type</span>
          <span className="veh-detail-value">{vehicle.carType}</span>
        </div>
        <div className="veh-detail-block">
          <span className="veh-detail-label">Year</span>
          <span className="veh-detail-value">{vehicle.manufactureYear}</span>
        </div>
        <div className="veh-detail-block">
          <span className="veh-detail-label">Mileage</span>
          <span className="veh-detail-value">{(vehicle.mileage || 0).toLocaleString('en-IN')} km</span>
        </div>
      </div>
    </button>
  )
}
