// The logo's mark as an image, for the generated app icons (only inline styles work there)
export function LogoMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#4f46e5',
        color: 'white',
        fontSize: size * 0.62,
        fontWeight: 900,
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      E
    </div>
  );
}
