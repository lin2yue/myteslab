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
                    styles: 'bg-blue-50 text-blue-600 border-blue-100',
                };
            case WRAP_CATEGORY.AI_GENERATED:
                return {
                    label: t('category_ai_generated'),
                    styles: 'bg-purple-50 text-purple-600 border-purple-100',
                };
            case WRAP_CATEGORY.DIY:
            default:
                return {
                    label: t('category_diy'),
                    styles: 'bg-green-50 text-green-600 border-green-100',
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
