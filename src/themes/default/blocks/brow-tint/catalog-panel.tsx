'use client';

import { useMemo, useState } from 'react';
import { Button, SearchField } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/shared/lib/utils';

import { browShapeLabel } from './shape-label';
import type { BrowStyleItem } from './types';

import './catalog-panel.css';

interface BrowCatalogPanelProps {
  styles: BrowStyleItem[];
  selectedStyleId: string | null;
  confirmed: boolean;
  allowPreselection?: boolean;
  disabled: boolean;
  onSelect: (style: BrowStyleItem) => void;
}

export function BrowCatalogPanel({
  styles,
  selectedStyleId,
  confirmed,
  allowPreselection = false,
  disabled,
  onSelect,
}: BrowCatalogPanelProps) {
  const locale = useLocale();
  const t = useTranslations('pages.ai-brow-tint');
  const [search, setSearch] = useState('');
  const [shape, setShape] = useState<string | null>(null);
  const shapes = useMemo(
    () => [...new Set(styles.map((style) => style.shape))].sort(),
    [styles]
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return styles.filter((style) => {
      const searchable = `${browShapeLabel(style, locale)} ${style.shape} `;
      return (
        (!shape || style.shape === shape) &&
        (!query || searchable.toLocaleLowerCase().includes(query))
      );
    });
  }, [styles, search, shape, locale]);

  return (
    <div className="brow-catalog">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('ui.choose_a_brow_style')}</h3>
        <span className="text-muted shrink-0 text-xs tabular-nums">
          {filtered.length} / {styles.length}
        </span>
      </div>
      <SearchField
        aria-label={t('ui.search_eyebrow_shapes')}
        value={search}
        onChange={setSearch}
        variant="secondary"
        className="brow-catalog__search"
        fullWidth
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t('ui.search_eyebrow_shapes')} />
          <SearchField.ClearButton aria-label={t('ui.clear_search')} />
        </SearchField.Group>
      </SearchField>
      <div
        className="brow-catalog__filters"
        role="group"
        aria-label={t('ui.filter_by_shape')}
      >
        {[null, ...shapes].map((value) => (
          <Button
            key={value ?? 'all'}
            size="sm"
            variant={shape === value ? 'secondary' : 'ghost'}
            className="h-8 min-w-0 px-2.5 text-xs capitalize"
            aria-pressed={shape === value}
            onPress={() => setShape(value)}
          >
            {value ? browShapeLabel({ shape: value }, locale) : t('ui.all')}
          </Button>
        ))}
      </div>
      {!confirmed && !allowPreselection && (
        <p className="text-muted text-xs leading-relaxed">
          {t('ui.confirm_your_mapping_to_try_a_style')}
        </p>
      )}
      <div
        className="brow-catalog__results"
        role="region"
        aria-label={t('ui.brow_style_samples')}
      >
        {filtered.length ? (
          <div className="brow-catalog__grid">
            {filtered.map((style) => {
              const selected = style.id === selectedStyleId;
              return (
                <Button
                  key={style.id}
                  variant="ghost"
                  onPress={() => onSelect(style)}
                  isDisabled={disabled || (!confirmed && !allowPreselection)}
                  aria-pressed={selected}
                  aria-label={browShapeLabel(style, locale)}
                  className={cn(
                    'brow-catalog__tile h-auto min-w-0 flex-col items-stretch gap-2 rounded-xl p-1.5 text-left whitespace-normal',
                    selected && 'bg-surface-secondary ring-accent ring-2'
                  )}
                >
                  <span className="bg-surface-secondary relative block aspect-[2/1] w-full overflow-hidden rounded-lg">
                    {style.thumbnail ? (
                      <img
                        src={style.thumbnail}
                        width={300}
                        height={150}
                        alt={browShapeLabel(style, locale)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="text-muted flex h-full items-center justify-center px-2 text-xs">
                        {t('ui.no_sample_image')}
                      </span>
                    )}
                    {selected && (
                      <span className="bg-overlay/90 text-foreground absolute right-1.5 bottom-1.5 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm">
                        {t('ui.selected')}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs font-medium">
                    {browShapeLabel(style, locale)}
                  </span>
                  <span className="text-muted -mt-1 block truncate text-[11px] font-normal capitalize">
                    {t('ui.eyebrow_filter')} · {browShapeLabel(style, locale)}
                  </span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-muted text-sm">{t('ui.no_matching_styles')}</p>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setSearch('');
                setShape(null);
              }}
            >
              {t('ui.clear_filters')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
