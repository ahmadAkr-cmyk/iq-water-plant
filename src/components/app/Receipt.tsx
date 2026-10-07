import type { Sale } from "@/api";
import { fmtDateTime, rs } from "@/lib/format";

/** Shown only when printing. 80mm thermal receipt. */
export function Receipt({ sale, businessName, balance }: { sale: Sale; businessName: string; balance?: number | null }) {
  return (
    <div className="print-only print-area">
      <div className="receipt text-center">
        <h2 className="text-lg font-bold">{businessName}</h2>
        <p>Bill: {sale.billNo}</p>
        <p>{fmtDateTime(sale.createdAt)}</p>
        <p>{sale.customerName}</p>
        <hr className="my-2" />
        {sale.items.map((i) => (
          <div key={i.productId} className="flex justify-between"><span>{i.name} x {i.qty}</span><span>{rs(i.lineTotal)}</span></div>
        ))}
        {sale.deliveryFee > 0 && <div className="flex justify-between"><span>Delivery</span><span>{rs(sale.deliveryFee)}</span></div>}
        <hr className="my-2" />
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{rs(sale.total)}</span></div>
        <p className="capitalize">Payment: {sale.paymentType}</p>
        {balance != null && <p>Balance: {balance > 0 ? "Udhar " : balance < 0 ? "Advance " : ""}{rs(balance)}</p>}
        <p className="mt-2">Shukriya!</p>
      </div>
    </div>
  );
}
