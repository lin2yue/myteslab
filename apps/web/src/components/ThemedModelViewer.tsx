'use client';

import { useEffect, useState } from 'react';
import { ModelViewerClient } from '@/components/ModelViewerClient';
import type { ComponentProps } from 'react';
import { getEffectiveTheme, THEME_CHANGE_EVENT } from '@/utils/theme';

type ModelViewerProps = ComponentProps<typeof ModelViewerClient>;

interface ThemedModelViewerProps extends ModelViewerProps {
    lightBackground?: string;
    darkBackground?: string;
}

export default function ThemedModelViewer({
    lightBackground = '#FFFFFF',
    darkBackground = '#1F1F1F',
    ...props
}: ThemedModelViewerProps) {
    const [backgroundColor, setBackgroundColor] = useState(lightBackground);

    useEffect(() => {
        const resolveBackground = (effectiveTheme?: string) => {
            const theme = effectiveTheme || getEffectiveTheme();
            setBackgroundColor(theme === 'dark' ? darkBackground : lightBackground);
        };

        resolveBackground();

        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail as { effective?: string } | undefined;
            resolveBackground(detail?.effective);
        };
        window.addEventListener(THEME_CHANGE_EVENT, handler as EventListener);
        return () => window.removeEventListener(THEME_CHANGE_EVENT, handler as EventListener);
    }, [lightBackground, darkBackground]);

    return <ModelViewerClient {...props} backgroundColor={backgroundColor} />;
}
