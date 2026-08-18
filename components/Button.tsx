import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'btn-sacred-primary',
    secondary: 'btn-sacred-gold',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-400',
  };

  return (
    <button
      disabled={disabled}
      className={`
        transition-all duration-300 ease-in-out
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};
