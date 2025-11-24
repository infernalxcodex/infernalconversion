import { z } from "zod";
import { pgTable, text, timestamp, serial, integer, boolean } from "drizzle-orm/pg-core"; // <-- Added serial, integer, boolean
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const paymentSessions = pgTable('payment_sessions', {
  id: serial('id').primaryKey(),

  // Foreign key linking the payment to a user
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // The unique ID provided by the payment processor (e.g., Stripe)
  externalSessionId: text('external_session_id').unique().notNull(),

  // The amount paid (stored in cents/lowest denomination)
  amountPaidCents: integer('amount_paid_cents').notNull(),

  // Currency code (e.g., 'usd')
  currency: text('currency').notNull(),

  // Timestamp of when the payment was successfully completed
  paidAt: timestamp('paid_at').defaultNow().notNull(),
});

export const pendingConversionsTable = pgTable("pending_conversions", {
  sessionId: text("session_id").primaryKey(),
  jsonInput: text("json_input").notNull(),
  outputFormat: text("output_format").notNull(),
  tableName: text("table_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PendingConversion = typeof pendingConversionsTable.$inferSelect;
export type InsertPendingConversion = typeof pendingConversionsTable.$inferInsert;
export const insertPendingConversionSchema = createInsertSchema(pendingConversionsTable).omit({ createdAt: true });

export const conversionRequestSchema = z.object({
  jsonInput: z.string().min(1, "JSON input is required"),
  outputFormat: z.enum(["sql", "csv"]),
  tableName: z.string().optional(),
  sessionId: z.string().optional(),
});

export type ConversionRequest = z.infer<typeof conversionRequestSchema>;

export interface ConversionResult {
  output: string;
  lineCount: number;
  nestingLevel: number;
  requiresPayment: boolean;
}

export interface ConversionStats {
  lineCount: number;
  nestingLevel: number;
  objectCount: number;
}

export const checkoutSessionSchema = z.object({
  priceId: z.string(),
  mode: z.enum(["payment", "subscription"]),
});

export type CheckoutSessionRequest = z.infer<typeof checkoutSessionSchema>;

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  interval: "one-time" | "month" | "year";
  features: string[];
}

export const PRICING_TIERS: PricingTier[] = [
  // ... (Your pricing tiers array content remains unchanged)
  {
    id: "one-time",
    name: "One-Time Purchase",
    price: 9.99,
    interval: "one-time",
    features: [
      "Unlimited conversions for 24 hours",
      "No file size limits",
      "All export formats (SQL, CSV)",
      "Priority processing",
      "Email support"
    ]
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    price: 19.99,
    interval: "month",
    features: [
      "Unlimited conversions",
      "No file size limits",
      "All export formats",
      "Priority processing",
      "Advanced export options",
      "Email & chat support",
      "Conversion history (coming soon)"
    ]
  },
  {
    id: "annual",
    name: "Annual Pro",
    price: 199.99,
    interval: "year",
    features: [
      "Everything in Monthly Pro",
      "Save $39.89 per year",
      "API access (coming soon)",
      "Custom templates (coming soon)",
      "Batch processing (coming soon)",
      "Priority support"
    ]
  }
];
