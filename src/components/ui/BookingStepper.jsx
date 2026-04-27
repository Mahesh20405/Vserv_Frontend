export function BookingStepper({ steps = [], step = 0, onStepChange }) {
  return (
    <div className="stepper">
      {steps.map((label, index) => (
        <div key={label} className="stepper-fragment">
          <div
            className={`step-item ${index <= step ? 'clickable' : ''}`}
            onClick={() => {
              if (index <= step) onStepChange?.(index)
            }}
          >
            <div className={`step-num ${index < step ? 'done' : index === step ? 'active' : 'pending'}`}>{index < step ? 'OK' : index + 1}</div>
            <div className={`step-label ${index < step ? 'done' : index === step ? 'active' : 'pending'}`}>{label}</div>
          </div>
          {index < steps.length - 1 ? <div className={`step-connector ${index < step ? 'done' : 'pending'}`} /> : null}
        </div>
      ))}
    </div>
  )
}
