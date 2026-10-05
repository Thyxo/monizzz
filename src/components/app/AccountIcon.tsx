export default function AccountIcon({ type, color, size = 20 }: { type: string; color: string; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'opsparing':
      return (
        <svg {...props}>
          <path d="M4 16l6-6 4 4 6-8"></path>
          <path d="M15 6h5v5"></path>
        </svg>
      );
    case 'monizz':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="4"></circle>
        </svg>
      );
    case 'donation':
      return (
        <svg {...props}>
          <path d="M12 20s-7-4.35-9.5-8.5C.5 7.5 3 4 6.5 4c2 0 3.5 1.2 4.5 2.8C12 5.2 13.5 4 15.5 4 19 4 21.5 7.5 21.5 11.5 19 15.65 12 20 12 20Z"></path>
        </svg>
      );
    case 'goal_savings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="4.5"></circle>
          <circle cx="12" cy="12" r="1.2" fill={color} stroke="none"></circle>
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3H5"></path>
          <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z"></path>
          <circle cx="16" cy="14" r="1.4" fill={color} stroke="none"></circle>
        </svg>
      );
  }
}
