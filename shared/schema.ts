import { z } from "zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

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
