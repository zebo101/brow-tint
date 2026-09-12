'use client';

import { Segment } from '@heroui-pro/react';
import { Button } from '@heroui/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import type {
  BrowAnchorTarget,
  BrowCandidate,
  Point,
} from '@/shared/lib/brow-mapping/types';

import { browText } from './copy';

export interface AnchorEditing {
  active: boolean;
  selected: BrowAnchorTarget;
  onActiveChange: (active: boolean) => void;
  onSelect: (target: BrowAnchorTarget) => void;
  onMove: (target: BrowAnchorTarget, position: Point) => void;
  onReset: (target?: BrowAnchorTarget) => void;
}

export function AnchorEditor({
  editing,
  candidate,
  disabled,
  zh,
}: {
  editing: AnchorEditing;
  candidate: BrowCandidate | null;
  disabled: boolean;
  zh: boolean;
}) {
  const locale = useLocale();
  const { active, selected } = editing;
  return (
    <div className="brow-anchor-editor">
      <Button
        size="sm"
        variant={active ? 'secondary' : 'ghost'}
        isDisabled={disabled}
        aria-pressed={active}
        onPress={() => editing.onActiveChange(!active)}
      >
        {active
          ? browText(locale, 'Done correcting', '完成点位校正')
          : browText(locale, 'Correct anchor points', '校正定位点')}
      </Button>
      {active && (
        <>
          <div className="brow-anchor-selectors">
            <Segment
              size="sm"
              aria-label={browText(locale, 'Brow to correct', '校正哪侧眉毛')}
              selectedKey={selected.side}
              isDisabled={disabled}
              onSelectionChange={(key) =>
                editing.onSelect({
                  ...selected,
                  side: String(key) as BrowAnchorTarget['side'],
                })
              }
            >
              <Segment.Item id="left">
                {browText(locale, 'Left', '画面左')}
              </Segment.Item>
              <Segment.Item id="right">
                {browText(locale, 'Right', '画面右')}
              </Segment.Item>
            </Segment>
            <Segment
              size="sm"
              aria-label={browText(
                locale,
                'Anchor to correct',
                '校正哪个定位点'
              )}
              selectedKey={selected.point}
              isDisabled={disabled}
              onSelectionChange={(key) =>
                editing.onSelect({
                  ...selected,
                  point: String(key) as BrowAnchorTarget['point'],
                })
              }
            >
              <Segment.Item id="head">
                {browText(locale, 'Head', '眉头')}
              </Segment.Item>
              <Segment.Item id="arch">
                {browText(locale, 'Arch', '眉峰')}
              </Segment.Item>
              <Segment.Item id="tail">
                {browText(locale, 'Tail', '眉尾')}
              </Segment.Item>
            </Segment>
          </div>
          <div
            className="brow-anchor-nudge"
            aria-label={browText(
              locale,
              'Move one image pixel',
              '每次移动一个图像像素'
            )}
          >
            {[
              {
                Icon: ArrowLeft,
                x: -1,
                y: 0,
                label: browText(locale, 'Nudge left', '向左微调'),
              },
              {
                Icon: ArrowUp,
                x: 0,
                y: -1,
                label: browText(locale, 'Nudge up', '向上微调'),
              },
              {
                Icon: ArrowDown,
                x: 0,
                y: 1,
                label: browText(locale, 'Nudge down', '向下微调'),
              },
              {
                Icon: ArrowRight,
                x: 1,
                y: 0,
                label: browText(locale, 'Nudge right', '向右微调'),
              },
            ].map(({ Icon, x, y, label }) => (
              <Button
                key={label}
                size="sm"
                variant="secondary"
                isIconOnly
                aria-label={label}
                isDisabled={disabled || !candidate}
                onPress={() => {
                  const point =
                    candidate?.brows[selected.side === 'left' ? 0 : 1][
                      selected.point
                    ];
                  if (point)
                    editing.onMove(selected, {
                      x: point.x + x,
                      y: point.y + y,
                    });
                }}
              >
                <Icon size={15} />
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              isDisabled={disabled}
              onPress={() => editing.onReset(selected)}
            >
              <RotateCcw size={13} />
              {browText(locale, 'Reset point', '恢复此点')}
            </Button>
          </div>
          <p>
            {browText(
              locale,
              'Drag a point or nudge by 1 px. Confirm the mapping again after correcting.',
              '拖动圆点，或用方向按钮每次微调 1 px。校正后需重新确认。'
            )}
          </p>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={disabled}
            onPress={() => editing.onReset()}
          >
            {browText(
              locale,
              'Reset all anchor corrections',
              '清除全部点位校正'
            )}
          </Button>
        </>
      )}
    </div>
  );
}
