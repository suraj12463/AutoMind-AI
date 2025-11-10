import React from 'react';

interface MiniSparklineProps {
    data: number[];
    width?: number;
    height?: number;
    stroke?: string;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, width = 100, height = 24, stroke = "#8B949E" }) => {
    if (!data || data.length < 2) {
        return <div style={{width, height}} className="flex items-center justify-center text-xs text-brand-gray">No data</div>;
    }
    
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <polyline
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                points={points}
            />
        </svg>
    );
};

export default MiniSparkline;
