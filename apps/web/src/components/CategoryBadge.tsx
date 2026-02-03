import React from 'react';
import { useTranslations } from 'next-intl';
import { WRAP_CATEGORY } from '@/lib/constants/category';

interface CategoryBadgeProps {
    category?: string;
    className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className = "" }) => {
    const t = useTranslations('Common');

    const getCategoryConfig = (cat?: string) => {
        switch (cat) {
            case WRAP_CATEGORY.OFFICIAL:
                return {
                    label: t('category_official'),
                    styles: 'bg-black/5 text-gray-700 border-black/10',
                };
            case WRAP_CATEGORY.AI_GENERATED:
                return {
                    label: t('category_ai_generated'),
                    styles: 'bg-black/10 text-gray-800 border-black/15',
                };
            case WRAP_CATEGORY.DIY:
            default:
                return {
                    label: t('category_diy'),
                    styles: 'bg-black/5 text-gray-600 border-black/10',
                };
        }
    };

    const config = getCategoryConfig(category);

    return (
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${config.styles} ${className}`}>
            {config.label}
        </span>
    );
};
