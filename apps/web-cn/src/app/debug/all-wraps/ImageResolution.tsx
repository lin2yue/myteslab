'use client';

import { useState } from 'react';

export default function ImageResolution({ src, alt, className, containerClassName }: {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
}) {
    const [resolution, setResolution] = useState<string>('Loading...');

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const img = e.currentTarget;
        setResolution(`${img.naturalWidth} x ${img.naturalHeight}`);
    };

    return (
        <div className={containerClassName}>
            <div className="relative group">
                <img
                    src={src}
                    alt={alt}
                    className={className}
                    onLoad={handleLoad}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] py-0.5 px-1 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Resolution: {resolution}
                </div>
            </div>
            <div className={`text-[9px] font-mono text-center mt-1 pt-0.5 border-t border-gray-800/50 ${resolution === '1024 x 1024' ? 'text-yellow-500 font-bold' : 'text-gray-500'}`}>
                {resolution}
            </div>
        </div>
    );
}
