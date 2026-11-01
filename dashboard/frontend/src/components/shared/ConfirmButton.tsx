import { useState, type ReactNode } from 'react';

interface ConfirmButtonProps {
  confirmLabel: string;
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'danger' | 'success' | 'primary';
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function ConfirmButton({
  confirmLabel,
  confirmText = 'Confirm action?',
  onConfirm,
  variant = 'danger',
  disabled = false,
  className = '',
  children,
}: ConfirmButtonProps): ReactNode {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClick = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsConfirming(false);
    await onConfirm();
  };

  const buttonClass = variant === 'success' ? 'btn btn-success' : variant === 'primary' ? 'btn btn-primary' : 'btn btn-danger';

  return (
    <button
      className={`${buttonClass} ${className}`.trim()}
      disabled={disabled}
      onClick={handleClick}
      aria-label={isConfirming ? confirmLabel : undefined}
      title={confirmLabel}
    >
      {isConfirming ? confirmText : children}
    </button>
  );
}
