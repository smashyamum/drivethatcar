import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  CallForm,
  EmailForm,
  FollowUpForm,
  NoteForm,
  StatusForm,
  WhatsAppForm,
} from "@/components/admin/customer-detail-actions";
import { DeleteLeadForm } from "@/components/admin/delete-lead-form";
import { deleteLead } from "../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import { formatDateTimeInTz } from "@/lib/tz";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  type Booking,
  type BookingStatus,
  type Car,
  type Customer,
  type CustomerActivity,
  type CustomerActivityKind,
  type LeadStatus,
  type Settings,
} from "@/lib/supabase/types";

export const metadata = { title: "Customer · Admin" };

const STATUS_TONE: Record<BookingStatus, "success" | "warning" | "danger" | "neutral"> = {
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "warning",
};
const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};
const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;

const ACTIVITY_LABEL: Record<CustomerActivityKind, string> = {
  note: "Note",
  call: "Call logged",
  whatsapp_sent: "WhatsApp sent",
  email_sent: "Email sent",
  sms_sent: "SMS sent",
  meeting: "Meeting",
  status_change: "Status changed",
  follow_up_set: "Follow-up set",
  lead_created: "Lead created",
};

type BookingWithCar = Booking & {
  car: Pick<Car, "id" | "year" | "make" | "model" | "variant"> | null;
};

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errorParam } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();

  const [
    { data: customerData },
    { data: bookingData },
    { data: activityData },
    { data: settingsData },
    { data: interestedCar },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bookings")
      .select("*, car:cars(id, year, make, model, variant)")
      .eq("customer_id", id)
      .order("start_at", { ascending: false }),
    supabase
      .from("customer_activities")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("settings").select("*").eq("organization_id", orgId).single(),
    supabase
      .from("customers")
      .select("interested_car:cars!customers_interested_car_id_fkey(id, year, make, model, variant)")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!customerData) notFound();
  const customer = customerData as Customer;
  const bookings = (bookingData ?? []) as unknown as BookingWithCar[];
  const activities = (activityData ?? []) as CustomerActivity[];
  const settings = settingsData as Settings;
  const interested = (interestedCar as { interested_car: Pick<Car, "id" | "year" | "make" | "model" | "variant"> | null } | null)?.interested_car;
  const businessName = settings.business_name ?? "Car Booking";
  const phoneDigits = customer.phone.replace(/\D/g, "");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← All customers
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <p className="mt-1 text-sm text-fg-muted">
              <a href={`tel:${customer.phone}`} className="hover:underline">
                {customer.phone}
              </a>
              {" · "}
              <a href={`mailto:${customer.email}`} className="hover:underline">
                {customer.email}
              </a>
              {customer.lead_source && (
                <span className="text-fg-muted"> · via {customer.lead_source}</span>
              )}
            </p>
          </div>
          <Badge tone={LEAD_STATUS_TONE[customer.lead_status]}>
            {LEAD_STATUS_LABEL[customer.lead_status]}
          </Badge>
        </div>
        {interested && (
          <p className="mt-2 text-sm text-fg-muted">
            Interested in:{" "}
            <span className="font-medium text-fg">
              {interested.year} {interested.make} {interested.model}
              {interested.variant ? ` ${interested.variant}` : ""}
            </span>
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Pipeline</h2>
        <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-bg p-4">
          <StatusForm customerId={customer.id} currentStatus={customer.lead_status as LeadStatus} />
          <FollowUpForm customerId={customer.id} currentValue={customer.next_follow_up_at} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${customer.phone}`}>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-3 text-[13px] font-semibold hover:bg-bg-subtle"
            >
              Call
            </button>
          </a>
          <a href={`mailto:${customer.email}`}>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-3 text-[13px] font-semibold hover:bg-bg-subtle"
            >
              Mail (open client)
            </button>
          </a>
          <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-3 text-[13px] font-semibold hover:bg-bg-subtle"
            >
              Open WhatsApp
            </button>
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <CallForm customerId={customer.id} />
          <WhatsAppForm
            customerId={customer.id}
            phone={customer.phone}
            customerName={customer.name}
            businessName={businessName}
          />
          <EmailForm customerId={customer.id} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Add note</h2>
        <NoteForm customerId={customer.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Activity ({activities.length})
        </h2>
        {activities.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-6 text-center text-sm text-fg-muted">
            Nothing logged yet.
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {activities.map((a) => (
              <li
                key={a.id}
                className="rounded-[12px] border border-border bg-bg p-4 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    {ACTIVITY_LABEL[a.kind]}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {formatDateTimeInTz(new Date(a.created_at), settings.timezone)}
                  </span>
                </div>
                {a.body && (
                  <p className="mt-1 whitespace-pre-line text-fg">{a.body}</p>
                )}
                {a.kind === "status_change" && a.metadata && (
                  <p className="mt-1 text-fg-muted">
                    {String(a.metadata.from ?? "—")} → {String(a.metadata.to ?? "—")}
                  </p>
                )}
                {a.kind === "follow_up_set" && a.metadata && (
                  <p className="mt-1 text-fg-muted">
                    {a.metadata.at
                      ? `Scheduled for ${formatDateTimeInTz(new Date(String(a.metadata.at)), settings.timezone)}`
                      : "Cleared"}
                  </p>
                )}
                {a.kind === "email_sent" && typeof a.metadata?.subject === "string" && (
                  <p className="mt-1 text-xs text-fg-muted">
                    Subject: {a.metadata.subject}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Bookings ({bookings.length})
        </h2>
        {bookings.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-6 text-center text-sm text-fg-muted">
            No bookings yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Car</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-bg-subtle">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatDateTimeInTz(new Date(b.start_at), settings.timezone)}
                      </Link>
                      <div className="font-mono text-xs text-fg-muted">{b.reference}</div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {b.car
                        ? `${b.car.year} ${b.car.make} ${b.car.model}${b.car.variant ? ` ${b.car.variant}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{TYPE_LABEL[b.type]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-[12px] border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-base font-semibold text-red-900">Danger zone</h2>
        {errorParam && (
          <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            Delete failed: {errorParam}
          </p>
        )}
        <p className="mt-3 text-sm text-red-800/80">
          Permanently delete this lead. This also removes their{" "}
          <strong>{bookings.length}</strong> booking
          {bookings.length === 1 ? "" : "s"} and full activity log. No
          cancellation email is sent — if you want to notify them first,
          cancel any future bookings before deleting.
        </p>
        <div className="mt-4">
          <DeleteLeadForm
            action={deleteLead.bind(null, customer.id)}
            customerName={customer.name}
            bookingCount={bookings.length}
          />
        </div>
      </div>
    </div>
  );
}
