import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Delete, Copy, Check, PlusCircle, MinusCircle, Calculator } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface CaisseCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberLabel?: string;
  onApplyToIncome?: (amountStr: string) => void;
  onApplyToExpense?: (amountStr: string) => void;
}

const OPERATORS = new Set(['+', '-', '×', '÷']);

function formatCalcNumber(num: number): string {
  if (!Number.isFinite(num)) return 'خطأ';
  const rounded = Math.round(num * 1000000) / 1000000;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

/**
 * Safe recursive-descent arithmetic evaluator (+, -, ×, ÷, %) without eval().
 */
export function evaluateCalculatorExpression(rawExpr: string): number | null {
  const cleaned = rawExpr
    .replace(/\s+/g, '')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/,/g, '.');

  if (!cleaned) return null;

  // Strip trailing dangling operator so live preview evaluates cleanly while typing
  let expr = cleaned;
  while (expr.length > 0 && OPERATORS.has(expr[expr.length - 1])) {
    expr = expr.slice(0, -1);
  }
  if (!expr) return null;

  let pos = 0;

  const peek = () => expr[pos] || '';

  const parseNumber = (): number | null => {
    let sign = 1;
    if (peek() === '-') {
      sign = -1;
      pos += 1;
    } else if (peek() === '+') {
      pos += 1;
    }

    const start = pos;
    let hasDot = false;
    while (pos < expr.length) {
      const ch = expr[pos];
      if (ch >= '0' && ch <= '9') {
        pos += 1;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        pos += 1;
      } else {
        break;
      }
    }

    if (pos === start) return null;
    const rawNum = expr.slice(start, pos);
    if (rawNum === '.') return null;

    let value = parseFloat(rawNum) * sign;
    if (!Number.isFinite(value)) return null;

    while (peek() === '%') {
      value = value / 100;
      pos += 1;
    }
    return value;
  };

  const parseMulDiv = (): number | null => {
    let left = parseNumber();
    if (left === null) return null;

    while (peek() === '×' || peek() === '÷') {
      const op = expr[pos];
      pos += 1;
      const right = parseNumber();
      if (right === null) return null;
      if (op === '×') {
        left = left * right;
      } else {
        if (right === 0) return Number.NaN;
        left = left / right;
      }
    }
    return left;
  };

  const parseAddSub = (): number | null => {
    let left = parseMulDiv();
    if (left === null) return null;

    while (peek() === '+' || peek() === '-') {
      const op = expr[pos];
      pos += 1;
      const right = parseMulDiv();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const result = parseAddSub();
  if (pos !== expr.length) return null;
  if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
    return result !== null && Number.isNaN(result) ? Number.NaN : null;
  }
  return result;
}

export const CaisseCalculatorModal: React.FC<CaisseCalculatorModalProps> = ({
  isOpen,
  onClose,
  barberLabel,
  onApplyToIncome,
  onApplyToExpense,
}) => {
  const [expression, setExpression] = useState<string>('0');
  const [historyLine, setHistoryLine] = useState<string>('');
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const liveResult = useMemo(() => {
    if (hasError) return null;
    const val = evaluateCalculatorExpression(expression);
    if (val === null || Number.isNaN(val)) return val;
    return val;
  }, [expression, hasError]);

  const hasOperatorInExpr = useMemo(() => {
    const body = expression.startsWith('-') ? expression.slice(1) : expression;
    return /[+\-×÷%]/.test(body);
  }, [expression]);

  const applicableNumber = useMemo(() => {
    if (hasError || liveResult === null || Number.isNaN(liveResult)) return null;
    const rounded = Math.round(liveResult * 100) / 100;
    return rounded > 0 ? rounded : null;
  }, [hasError, liveResult]);

  const handleClear = useCallback(() => {
    setExpression('0');
    setHistoryLine('');
    setJustEvaluated(false);
    setHasError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    if (hasError) {
      handleClear();
      return;
    }
    setJustEvaluated(false);
    setExpression((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [hasError, handleClear]);

  const appendDigit = useCallback(
    (digit: string) => {
      setHasError(false);
      if (justEvaluated) {
        setHistoryLine('');
        setJustEvaluated(false);
        setExpression(digit === '00' ? '0' : digit);
        return;
      }
      setExpression((prev) => {
        if (prev === '0') {
          return digit === '00' || digit === '0' ? '0' : digit;
        }
        // Prevent leading multiple zeros on current segment after an operator
        const lastOpIdx = Math.max(
          prev.lastIndexOf('+'),
          prev.lastIndexOf('-'),
          prev.lastIndexOf('×'),
          prev.lastIndexOf('÷')
        );
        const currentSeg = prev.slice(lastOpIdx + 1);
        if (currentSeg === '0') {
          if (digit === '0' || digit === '00') return prev;
          return prev.slice(0, lastOpIdx + 1) + digit;
        }
        if (currentSeg === '' && digit === '00') {
          return prev + '0';
        }
        if (currentSeg.endsWith('%')) {
          return prev;
        }
        return prev + digit;
      });
    },
    [justEvaluated]
  );

  const appendDecimal = useCallback(() => {
    setHasError(false);
    if (justEvaluated) {
      setHistoryLine('');
      setJustEvaluated(false);
      setExpression('0.');
      return;
    }
    setExpression((prev) => {
      const lastOpIdx = Math.max(
        prev.lastIndexOf('+'),
        prev.lastIndexOf('-'),
        prev.lastIndexOf('×'),
        prev.lastIndexOf('÷')
      );
      const currentSeg = prev.slice(lastOpIdx + 1);
      if (currentSeg.includes('.') || currentSeg.includes('%')) return prev;
      if (currentSeg === '') return prev + '0.';
      return prev + '.';
    });
  }, [justEvaluated]);

  const appendOperator = useCallback(
    (op: '+' | '-' | '×' | '÷') => {
      if (hasError) {
        setHasError(false);
        setExpression('0' + op);
        setJustEvaluated(false);
        return;
      }
      setJustEvaluated(false);
      setExpression((prev) => {
        const last = prev[prev.length - 1];
        if (OPERATORS.has(last)) {
          if (prev.length === 1 && prev === '-' && op !== '-') return '0' + op;
          return prev.slice(0, -1) + op;
        }
        if (last === '.') {
          return prev.slice(0, -1) + op;
        }
        return prev + op;
      });
    },
    [hasError]
  );

  const appendPercent = useCallback(() => {
    if (hasError) return;
    setJustEvaluated(false);
    setExpression((prev) => {
      const last = prev[prev.length - 1];
      if (!last || OPERATORS.has(last) || last === '.' || last === '%') return prev;
      return prev + '%';
    });
  }, [hasError]);

  const handleEquals = useCallback(() => {
    if (hasError) return;
    const val = evaluateCalculatorExpression(expression);
    if (val === null) return;
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      setHistoryLine(expression + ' =');
      setExpression('خطأ');
      setHasError(true);
      setJustEvaluated(true);
      return;
    }
    const formatted = formatCalcNumber(val);
    setHistoryLine(hasOperatorInExpr ? `${expression} =` : '');
    setExpression(formatted);
    setJustEvaluated(true);
  }, [expression, hasError, hasOperatorInExpr]);

  const handleCopy = useCallback(() => {
    const textToCopy =
      hasError || liveResult === null || Number.isNaN(liveResult)
        ? expression
        : formatCalcNumber(liveResult);
    if (!textToCopy || textToCopy === 'خطأ') return;

    const markCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(textToCopy).then(markCopied, () => {
          const ta = document.createElement('textarea');
          ta.value = textToCopy;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            markCopied();
          } catch {
            // ignore
          }
          document.body.removeChild(ta);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        markCopied();
      }
    } catch {
      // ignore
    }
  }, [expression, hasError, liveResult]);

  // Full desktop keyboard / numpad support (Acer Win 7 / Supermium station)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      if (key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        appendDigit(key);
        return;
      }
      if (key === '.' || key === ',') {
        e.preventDefault();
        appendDecimal();
        return;
      }
      if (key === '+') {
        e.preventDefault();
        appendOperator('+');
        return;
      }
      if (key === '-') {
        e.preventDefault();
        appendOperator('-');
        return;
      }
      if (key === '*' || key === 'x' || key === 'X') {
        e.preventDefault();
        appendOperator('×');
        return;
      }
      if (key === '/') {
        e.preventDefault();
        appendOperator('÷');
        return;
      }
      if (key === '%') {
        e.preventDefault();
        appendPercent();
        return;
      }
      if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (key === 'Delete' || key === 'c' || key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    onClose,
    appendDigit,
    appendDecimal,
    appendOperator,
    appendPercent,
    handleEquals,
    handleBackspace,
    handleClear,
  ]);

  if (!isOpen) return null;

  const previewText =
    !justEvaluated &&
    hasOperatorInExpr &&
    liveResult !== null &&
    !Number.isNaN(liveResult)
      ? formatCalcNumber(liveResult)
      : liveResult !== null && Number.isNaN(liveResult)
      ? 'لا يمكن القسمة على 0'
      : '';

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 sb-modal-backdrop"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[360px] rounded-3xl bg-white dark:bg-[#141720] border-2 border-stone-300 dark:border-zinc-700 shadow-2xl overflow-hidden text-xs select-none"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-stone-100 dark:bg-[#191D28] border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate">
                  الحاسبة السريعة — لاكيس
                </h4>
                {barberLabel && (
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block truncate">
                    {barberLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                title="نسخ النتيجة"
                aria-label="نسخ النتيجة"
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors ${
                  copied
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-zinc-900 border-stone-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق الحاسبة"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Android-Style Display Screen */}
          <div
            dir="ltr"
            className="px-4 py-4 bg-[#F8FAFC] dark:bg-[#0D1017] border-b border-stone-200 dark:border-zinc-800 text-right space-y-1 min-h-[104px] flex flex-col justify-end"
          >
            <div className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 min-h-[18px] truncate tabular-nums">
              {historyLine}
            </div>
            <div
              className={`font-mono font-black tracking-tight tabular-nums break-all leading-tight ${
                hasError
                  ? 'text-2xl text-rose-600 dark:text-rose-400'
                  : expression.length > 13
                  ? 'text-2xl text-zinc-900 dark:text-white'
                  : 'text-3xl sm:text-4xl text-zinc-900 dark:text-white'
              }`}
            >
              {expression}
            </div>
            <div className="min-h-[22px] text-base font-mono font-black tabular-nums">
              {previewText ? (
                <span
                  className={
                    previewText === 'لا يمكن القسمة على 0'
                      ? 'text-xs text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }
                >
                  = {previewText}
                </span>
              ) : null}
            </div>
          </div>

          {/* Android-Style 4x5 Keypad */}
          <div dir="ltr" className="p-3 sm:p-3.5 grid grid-cols-4 gap-2 bg-white dark:bg-[#141720]">
            {/* Row 1 */}
            <button
              type="button"
              onClick={handleClear}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#FEE2E2] hover:bg-[#FECACA] dark:bg-[#3B161E] dark:hover:bg-[#4C1D27] border border-[#FCA5A5] dark:border-[#9F1239] text-[#B91C1C] dark:text-rose-200 font-black text-lg cursor-pointer active:scale-95 transition-transform"
            >
              C
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="مسح آخر رقم"
              title="مسح رقم"
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#E2E8F0] hover:bg-[#CBD5E1] dark:bg-[#1E2430] dark:hover:bg-[#2A3242] border border-[#CBD5E1] dark:border-[#334155] text-slate-800 dark:text-zinc-100 font-black flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={appendPercent}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#E2E8F0] hover:bg-[#CBD5E1] dark:bg-[#1E2430] dark:hover:bg-[#2A3242] border border-[#CBD5E1] dark:border-[#334155] text-slate-800 dark:text-zinc-100 font-black text-xl cursor-pointer active:scale-95 transition-transform"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => appendOperator('÷')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#DBEAFE] hover:bg-[#BFDBFE] dark:bg-[#172540] dark:hover:bg-[#1E3154] border border-[#93C5FD] dark:border-[#2563EB] text-[#1D4ED8] dark:text-blue-300 font-black text-2xl cursor-pointer active:scale-95 transition-transform"
            >
              ÷
            </button>

            {/* Row 2 */}
            {['7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-2xl font-mono cursor-pointer active:scale-95 transition-transform"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('×')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#DBEAFE] hover:bg-[#BFDBFE] dark:bg-[#172540] dark:hover:bg-[#1E3154] border border-[#93C5FD] dark:border-[#2563EB] text-[#1D4ED8] dark:text-blue-300 font-black text-2xl cursor-pointer active:scale-95 transition-transform"
            >
              ×
            </button>

            {/* Row 3 */}
            {['4', '5', '6'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-2xl font-mono cursor-pointer active:scale-95 transition-transform"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('-')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#DBEAFE] hover:bg-[#BFDBFE] dark:bg-[#172540] dark:hover:bg-[#1E3154] border border-[#93C5FD] dark:border-[#2563EB] text-[#1D4ED8] dark:text-blue-300 font-black text-2xl cursor-pointer active:scale-95 transition-transform"
            >
              −
            </button>

            {/* Row 4 */}
            {['1', '2', '3'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-2xl font-mono cursor-pointer active:scale-95 transition-transform"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('+')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#DBEAFE] hover:bg-[#BFDBFE] dark:bg-[#172540] dark:hover:bg-[#1E3154] border border-[#93C5FD] dark:border-[#2563EB] text-[#1D4ED8] dark:text-blue-300 font-black text-2xl cursor-pointer active:scale-95 transition-transform"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onClick={() => appendDigit('00')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-lg font-mono cursor-pointer active:scale-95 transition-transform"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => appendDigit('0')}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-2xl font-mono cursor-pointer active:scale-95 transition-transform"
            >
              0
            </button>
            <button
              type="button"
              onClick={appendDecimal}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#F8FAFC] hover:bg-[#E2E8F0] dark:bg-[#1B202C] dark:hover:bg-[#252C3B] border border-[#CBD5E1] dark:border-[#2D3548] text-slate-900 dark:text-white font-black text-2xl font-mono cursor-pointer active:scale-95 transition-transform"
            >
              .
            </button>
            <button
              type="button"
              onClick={handleEquals}
              className="h-[52px] sm:h-[56px] rounded-2xl bg-[#059669] hover:bg-[#047857] border border-[#047857] text-white font-black text-2xl shadow-md cursor-pointer active:scale-95 transition-transform"
            >
              =
            </button>
          </div>

          {/* Optional Explicit Apply Actions (Only shown when a barber is active in Caisse & result > 0) */}
          {(onApplyToIncome || onApplyToExpense) && (
            <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-2 border-t border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-[#191D28]">
              {onApplyToIncome && (
                <button
                  type="button"
                  disabled={applicableNumber === null}
                  onClick={() => {
                    if (applicableNumber === null) return;
                    onApplyToIncome(String(applicableNumber));
                  }}
                  className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {applicableNumber !== null
                      ? `حط ${applicableNumber} MAD`
                      : 'حط في المجر'}
                  </span>
                </button>
              )}
              {onApplyToExpense && (
                <button
                  type="button"
                  disabled={applicableNumber === null}
                  onClick={() => {
                    if (applicableNumber === null) return;
                    onApplyToExpense(String(applicableNumber));
                  }}
                  className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {applicableNumber !== null
                      ? `هز ${applicableNumber} MAD`
                      : 'هز من المجر'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
