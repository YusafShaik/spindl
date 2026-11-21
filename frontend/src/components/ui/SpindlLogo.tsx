interface SpindlLogoProps {
  size?: number;
  className?: string;
}

export function SpindlLogo({ size = 26, className = '' }: SpindlLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Spindl"
    >
      <defs>
        <linearGradient id="spindl-brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6C78E6" />
          <stop offset="1" stopColor="#4F5BC7" />
        </linearGradient>
      </defs>
      <g fill="url(#spindl-brand-gradient)">
        <polygon points="18,168 49,102 112,102 139,47 226,47 194,112 132,112 105,168" />
        <polygon points="149,143 238,143 206,210 116,210" />
      </g>
    </svg>
  );
}
