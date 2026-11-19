import { formatDate } from '@/lib/format';

/** Biểu đồ cột SVG thuần (không thêm thư viện) + bảng ẩn cho trình đọc màn hình. */
export function VideosPerDayChart({
  data,
  label = 'Số video theo ngày',
  unit = 'video',
}: {
  data: { date: string; count: number }[];
  label?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = Math.ceil(max / 5) * 5;
  const ticks = niceMax <= 5 ? [0, niceMax] : [0, niceMax / 2, niceMax];
  const width = 640;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot * 0.62);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / niceMax) * innerH;
          return (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeDasharray="3 4"
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.count / niceMax) * innerH;
          const x = pad.left + i * slot + (slot - barW) / 2;
          const y = pad.top + innerH - h;
          const isLast = i === data.length - 1;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 1)}
                rx={4}
                className={
                  isLast ? 'fill-primary' : 'fill-primary/45 hover:fill-primary transition-colors'
                }
              >
                <title>{`${formatDate(d.date)}: ${d.count} ${unit}`}</title>
              </rect>
              {i % 2 === data.length % 2 || isLast ? (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10.5px]"
                >
                  {formatDate(d.date).slice(0, 5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
