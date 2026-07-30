export const CashmemoPrintPreview = ({
  customersToPrint,
  cashMemoRef,
  pageType,
  getCashMemoPerPage,
  renderCashMemo,
}) => {
  if (customersToPrint.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '40px' }}>
      <div ref={cashMemoRef}>
        {customersToPrint.map((item, index) => (
          <div
            key={index}
            style={{
              pageBreakAfter: (index + 1) % getCashMemoPerPage(pageType) === 0 ? 'always' : 'auto',
            }}
          >
            {renderCashMemo(item.customer)}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({ dialog, onClose, onConfirm }) => {
  if (!dialog.open) {
    return null;
  }

  return (
    <div className="app-dialog-overlay" onClick={onClose}>
      <div className="app-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="app-dialog__header">
          <h3 id="confirm-dialog-title">{dialog.title}</h3>
          <button type="button" className="app-dialog__close" onClick={onClose}>x</button>
        </div>
        <p className="app-dialog__message">{dialog.message}</p>
        {Array.isArray(dialog.previewItems) && dialog.previewItems.length > 0 && (
          <div className="app-dialog__preview-list">
            {dialog.previewTitle && <strong>{dialog.previewTitle}</strong>}
            <ul>
              {dialog.previewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {dialog.previewMoreText && <span>{dialog.previewMoreText}</span>}
          </div>
        )}
        {dialog.dangerNote && <p className="app-dialog__danger-note">{dialog.dangerNote}</p>}
        <div className="app-dialog__actions">
          <button type="button" className="auth-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="auth-primary-button" onClick={onConfirm}>{dialog.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export const InputDialog = ({ dialog, setDialog, onClose, onSubmit }) => {
  if (!dialog.open) {
    return null;
  }

  return (
    <div className="app-dialog-overlay" onClick={onClose}>
      <div className="app-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="input-dialog-title">
        <div className="app-dialog__header">
          <h3 id="input-dialog-title">{dialog.title}</h3>
          <button type="button" className="app-dialog__close" onClick={onClose}>x</button>
        </div>
        <p className="app-dialog__message">{dialog.message}</p>
        <input
          className="form-input app-dialog__input"
          value={dialog.value}
          onChange={(event) => setDialog((prev) => ({ ...prev, value: event.target.value }))}
          placeholder="Type here"
          autoFocus
        />
        <div className="app-dialog__actions">
          <button type="button" className="auth-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="auth-primary-button" onClick={onSubmit}>{dialog.submitLabel}</button>
        </div>
      </div>
    </div>
  );
};

export const OnboardingTourDialog = ({
  isOpen,
  onClose,
  activeOnboardingStep,
  onboardingSteps,
  onboardingStepIndex,
  setOnboardingStepIndex,
  handleOnboardingAction,
  handleOnboardingBack,
  handleOnboardingNext,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="app-dialog-overlay" onClick={() => onClose(true)}>
      <div className="app-dialog onboarding-tour-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
        <div className="app-dialog__header onboarding-tour-dialog__header">
          <div>
            <p className="onboarding-tour-dialog__eyebrow">Quick Tour</p>
            <h3 id="onboarding-tour-title">{activeOnboardingStep?.title || 'Getting Started'}</h3>
          </div>
          <button type="button" className="app-dialog__close" onClick={() => onClose(true)}>x</button>
        </div>
        <div className="onboarding-tour-dialog__progress">
          {onboardingSteps.map((step, index) => (
            <span
              key={step.id}
              className={`onboarding-tour-dialog__dot ${index === onboardingStepIndex ? 'is-active' : index < onboardingStepIndex ? 'is-complete' : ''}`}
            />
          ))}
        </div>
        <p className="app-dialog__message">{activeOnboardingStep?.description}</p>
        <div className="onboarding-tour-dialog__hint">{activeOnboardingStep?.hint}</div>
        <div className="onboarding-tour-dialog__step-list">
          {onboardingSteps.map((step, index) => (
            <button
              key={`tour-step-${step.id}`}
              type="button"
              className={`onboarding-tour-dialog__step ${index === onboardingStepIndex ? 'is-active' : ''}`}
              onClick={() => setOnboardingStepIndex(index)}
            >
              <strong>{index + 1}.</strong> {step.title}
            </button>
          ))}
        </div>
        <div className="app-dialog__actions onboarding-tour-dialog__actions">
          <button type="button" className="auth-secondary-button" onClick={() => onClose(true)}>Skip Tour</button>
          <button type="button" className="auth-secondary-button" onClick={handleOnboardingAction}>
            {activeOnboardingStep?.actionLabel || 'Open'}
          </button>
          <button type="button" className="auth-secondary-button" onClick={handleOnboardingBack} disabled={onboardingStepIndex === 0}>Back</button>
          <button
            type="button"
            className="auth-primary-button"
            onClick={handleOnboardingNext}
            aria-label={onboardingStepIndex === onboardingSteps.length - 1 ? 'Finish tour' : 'Next tour step'}
          >
            {onboardingStepIndex === onboardingSteps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminFlashMessage = ({ message, onClose }) => {
  if (!message) {
    return null;
  }

  return (
    <div className="admin-flash-message-overlay" onClick={onClose}>
      <div className="admin-flash-message" onClick={(event) => event.stopPropagation()}>
        <div className="admin-flash-message-header">
          <h3>Admin Reply</h3>
          <button type="button" className="admin-flash-message-close" onClick={onClose}>x</button>
        </div>
        <div className="admin-flash-message-body">
          <p>{message.message}</p>
        </div>
        <div className="admin-flash-message-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
