import { formatPrice } from "@/lib/format";
import type { OrderItem } from "@/lib/types";

export function OrderItemList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-4 py-3">
          <span className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg bg-accent-50 px-2 text-base font-bold text-accent-700">
            {item.quantity}×
          </span>
          <div className="flex-1">
            <p className="text-base font-semibold text-slate-900">{item.name}</p>
            {item.note && (
              <p className="mt-0.5 text-sm italic text-amber-700">
                Note: {item.note}
              </p>
            )}
            <p className="mt-0.5 text-sm text-slate-400">
              {formatPrice(item.unitPrice)} each
            </p>
          </div>
          <span className="text-base font-semibold text-slate-700">
            {formatPrice(item.totalPrice)}
          </span>
        </li>
      ))}
    </ul>
  );
}
