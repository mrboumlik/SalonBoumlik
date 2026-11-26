import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

export const CAISSE_QUICK_AMOUNTS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 66,
] as const;

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function sanitizeAmountInputString(raw: string): string {
  if (!raw) return '';
  let mapped = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    mapped += ARABIC_DIGIT_MAP[ch] ?? ch;
  }
  const normalized = mapped
    .replace(/,/g, '.')
    .replace(/[^\d.+]/g, '')
    .replace(/\+{2,}/g, '+')
    .replace(/^\+/, '');
  return normalized;
}

export function evaluateAmountExpression(raw: string): number {
  const cleaned = sanitizeAmountInputString(raw);
  if (!cleaned) return 0;
  const parts = cleaned.split('+').filter((part) => part.trim() !== '');
  if (parts.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const n = Number(parts[i]);
    if (Number.isFinite(n) && n > 0) {
      total += n;
    }
  }
  return Math.round(total * 100) / 100;
}

interface CaisseAmountFieldProps {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  quickAmounts?: readonly number[];
  accent?: 'emerald' | 'rose' | 'amber';
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  unitOnChips?: boolean;
  compact?: boolean;
}

export const CaisseAmountField: React.FC<CaisseAmountFieldProps> = ({
  label,
  value,
  onChange,
  quickAmounts = CAISSE_QUICK_AMOUNTS,
  accent = 'emerald',
  placeholder = '0',
  autoFocus = false,
  required = false,
  unitOnChips = false,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [combinedHint, setCombinedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setCombinedHint(null);
    }
  }, [value]);

  const isAddPending = value.trim().endsWith('+');
  const hasPlusExpr = value.includes('+');
  const evaluatedTotal = evaluateAmountExpression(value);
  const activeBorderCls =
    accent === 'rose'
      ? 'focus:border-rose-500'
      : accent === 'amber'
      ? 'focus:border-amber-500'
      : 'focus:border-emerald-500';

  const activeChipCls =
    accent === 'rose'
      ? 'bg-rose-600 text-white border-rose-600'
      : accent === 'amber'
      ? 'bg-amber-600 text-white border-amber-600'
      : 'bg-emerald-600 text-white border-emerald-600';

  const hoverChipCls =
    accent === 'rose'
      ? 'hover:border-rose-400'
      : accent === 'amber'
      ? 'hover:border-amber-400'
      : 'hover:border-emerald-400';

  const plusButtonCls = isAddPending
    ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-xs'
    : accent === 'rose'
    ? 'bg-[#FFE4E6] text-rose-900 border-[#FB7185] hover:bg-rose-600 hover:text-white dark:bg-[#33161E] dark:text-rose-200 dark:border-[#BE123C]'
    : accent === 'amber'
    ? 'bg-[#FEF3C7] text-amber-950 border-[#F59E0B] hover:bg-amber-600 hover:text-white dark:bg-[#2D2212] dark:text-amber-200 dark:border-[#B45309]'
    : 'bg-[#D1FAE5] text-emerald-950 border-[#34D399] hover:bg-emerald-600 hover:text-white dark:bg-[#143026] dark:text-emerald-200 dark:border-[#059669]';

  const handlePressPlus = () => {
    setCombinedHint(null);
    if (isAddPending) {
      inputRef.current?.focus();
      return;
    }
    if (hasPlusExpr) {
      if (evaluatedTotal > 0) {
        onChange(`${evaluatedTotal}+`);
      }
      inputRef.current?.focus();
      return;
    }
    if (evaluatedTotal > 0) {
      onChange(`${evaluatedTotal}+`);
      inputRef.current?.focus();
      return;
    }
    inputRef.current?.focus();
  };

  const handleSelectChip = (chip: number) => {
    if (isAddPending) {
      const base = evaluatedTotal;
      const sum = Math.round((base + chip) * 100) / 100;
      setCombinedHint(`${base} + ${chip} = ${sum} MAD`);
      onChange(String(sum));
      return;
    }
    setCombinedHint(null);
    onChange(String(chip));
  };

  const handleResolveEquals = () => {
    if (evaluatedTotal > 0) {
      const cleaned = sanitizeAmountInputString(value).replace(/\+$/, '');
      if (cleaned.includes('+')) {
        setCombinedHint(`${cleaned.replace(/\+/g, ' + ')} = ${evaluatedTotal} MAD`);
      }
      onChange(String(evaluatedTotal));
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block font-bold text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
      )}

      <div className="flex items-stretch gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={value}
            onChange={(e) => {
              setCombinedHint(null);
              onChange(sanitizeAmountInputString(e.target.value));
            }}
            placeholder={placeholder}
            required={required}
            autoFocus={autoFocus}
            className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 ${activeBorderCls} rounded-xl ${
              compact ? 'px-3 py-2 text-sm' : 'px-3.5 py-2.5 text-base'
            } pe-16 font-mono font-black tabular-nums text-zinc-900 dark:text-white outline-none`}
          />
          {value !== '' && (
            <button
              type="button"
              onClick={() => {
                setCombinedHint(null);
                onChange('');
                inputRef.current?.focus();
              }}
              title="مسح المبلغ"
              aria-label="مسح المبلغ"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-1 rounded-md text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handlePressPlus}
          title="زائد (+) لجمع مبلغين"
          aria-label="جمع مبلغين (+)"
          className={`shrink-0 ${
            compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-xs'
          } rounded-xl border font-black flex items-center gap-1 cursor-pointer transition-colors ${plusButtonCls}`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>زائد</span>
        </button>

        {hasPlusExpr && !isAddPending && evaluatedTotal > 0 && (
          <button
            type="button"
            onClick={handleResolveEquals}
            title="تأكيد المجموع"
            className="shrink-0 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-mono font-black text-xs cursor-pointer tabular-nums"
          >
            = {evaluatedTotal}
          </button>
        )}
      </div>

      {isAddPending && (
        <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <span className="font-mono font-black" dir="ltr">
            {evaluatedTotal} + ...
          </span>
          <span>اختر من الاقتراحات أو اكتب المبلغ الثاني للجمع</span>
        </div>
      )}

      {!isAddPending && combinedHint && (
        <div className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-300" dir="ltr">
          ✓ {combinedHint}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          مبالغ سريعة:
        </span>
        {quickAmounts.map((chip) => {
          const isExactChipSelected = !hasPlusExpr && evaluatedTotal === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleSelectChip(chip)}
              className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-black tabular-nums border cursor-pointer transition-colors ${
                isExactChipSelected
                  ? activeChipCls
                  : `bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 ${hoverChipCls}`
              }`}
            >
              {isAddPending ? `+${chip}` : unitOnChips ? `${chip} MAD` : chip}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handlePressPlus}
          title="جمع مبلغين (+)"
          className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-black border cursor-pointer transition-colors inline-flex items-center gap-0.5 ${plusButtonCls}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
