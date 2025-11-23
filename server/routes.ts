import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { conversionRequestSchema, checkoutSessionSchema } from "@shared/schema";
import type { ConversionResult } from "@shared/schema";
import { parseAndFlattenJSON } from "./lib/json-parser";
import { generateSQL } from "./lib/sql-generator";
import { generateCSV } from "./lib/csv-generator";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import express from "express";

// In-memory session store for payment verification
// In production, use a real database
const paidSessions = new Set<string>();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Webhook endpoint must come BEFORE json middleware to get raw body
  app.post("/api/webhook", express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).send('Webhook secret not configured');
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2024-11-20.acacia"
      });

      const event = stripe.webhooks.constructEvent(
        req.body, // Raw body buffer
        sig,
        webhookSecret
      );

      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          console.log('Payment successful:', session.id);
          // Store session ID to mark as paid
          if (session.id) {
            paidSessions.add(session.id);
          }
          break;
        
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object;
          console.log('Subscription updated:', subscription.id);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  app.post("/api/convert", async (req, res) => {
    try {
      const validatedData = conversionRequestSchema.parse(req.body);
      const { jsonInput, outputFormat, tableName } = validatedData;

      // Count lines from raw JSON input
      const lineCount = jsonInput.split('\n').length;

      // Parse JSON to get nesting level
      let parsed;
      try {
        parsed = parseAndFlattenJSON(jsonInput);
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          return res.status(400).json({ 
            message: "Invalid JSON format",
            error: parseError.message
          });
        }
        throw parseError;
      }

      // Check session ID for payment verification from multiple sources
      const sessionId = 
        req.query.session_id as string | undefined || 
        req.body.sessionId as string | undefined ||
        req.headers['x-session-id'] as string | undefined;
      
      const isPaid = sessionId ? paidSessions.has(sessionId) : false;
      
      // Check if payment is required (over 50 lines and not paid)
      if (lineCount > 50 && !isPaid) {
        const result: ConversionResult = {
          output: "",
          lineCount: lineCount,
          nestingLevel: parsed.maxNestingLevel,
          requiresPayment: true
        };
        return res.json(result);
      }

      // Generate output based on format
      let output: string;
      if (outputFormat === "sql") {
        output = generateSQL(parsed.data, tableName || "converted_data");
      } else {
        output = generateCSV(parsed.data);
      }

      const result: ConversionResult = {
        output,
        lineCount: lineCount,
        nestingLevel: parsed.maxNestingLevel,
        requiresPayment: false
      };

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }

      console.error("Conversion error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Conversion failed" 
      });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const validatedData = checkoutSessionSchema.parse(req.body);
      const { priceId, mode } = validatedData;
      const { jsonInput, outputFormat, tableName } = req.body;

      // Save JSON data to storage with a unique session ID
      // This session ID will be used after payment to retrieve and process the data
      const pendingSessionId = randomUUID();
      
      if (jsonInput && outputFormat) {
        await storage.savePendingConversion({
          sessionId: pendingSessionId,
          jsonInput,
          outputFormat,
          tableName: tableName || "converted_data",
        });
      }

      // Check if Stripe is configured
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(503).json({ 
          message: "Payment processing is not configured. Please add STRIPE_SECRET_KEY to environment variables." 
        });
      }

      // Map tier IDs to Stripe price IDs from environment
      const STRIPE_PRICE_MAP: Record<string, string | undefined> = {
        'one-time': process.env.STRIPE_PRICE_ONE_TIME,
        'monthly': process.env.STRIPE_PRICE_MONTHLY,
        'annual': process.env.STRIPE_PRICE_ANNUAL,
      };

      // Get the actual Stripe price ID
      let actualPriceId = priceId;
      
      // If priceId is a tier ID, map it to the actual Stripe price ID
      if (STRIPE_PRICE_MAP[priceId]) {
        actualPriceId = STRIPE_PRICE_MAP[priceId]!;
      }

      // Verify we have a valid price ID
      if (!actualPriceId) {
        return res.status(400).json({ 
          message: `Stripe price ID not configured for tier: ${priceId}. Please add STRIPE_PRICE_${priceId.toUpperCase().replace('-', '_')} to environment variables.` 
        });
      }

      // Dynamically import Stripe only when needed
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2024-11-20.acacia"
      });

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: mode,
        line_items: [
          {
            price: actualPriceId,
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin || 'http://localhost:10000'}/success?session_id={CHECKOUT_SESSION_ID}&pending_session=${pendingSessionId}`,
        cancel_url: `${req.headers.origin || 'http://localhost:10000'}?canceled=true`,
        automatic_tax: {
          enabled: true,
        },
        metadata: {
          pendingSessionId,
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }

      console.error("Stripe checkout error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create checkout session" 
      });
    }
  });

  // /success route - retrieve saved JSON and perform unlimited conversion
  app.get("/api/success", async (req, res) => {
    try {
      const pendingSessionId = req.query.pending_session as string | undefined;
      
      if (!pendingSessionId) {
        return res.status(400).json({ 
          message: "Missing pending_session parameter" 
        });
      }

      // Retrieve the saved JSON data
      const pendingData = await storage.getPendingConversion(pendingSessionId);
      if (!pendingData) {
        return res.status(404).json({ 
          message: "Pending conversion not found. Session may have expired." 
        });
      }

      // Parse and convert without payment restrictions
      let parsed;
      try {
        parsed = parseAndFlattenJSON(pendingData.jsonInput);
      } catch (parseError) {
        return res.status(400).json({ 
          message: "Invalid JSON format",
          error: parseError instanceof Error ? parseError.message : "Unknown error"
        });
      }

      // Generate output based on saved format
      let output: string;
      if (pendingData.outputFormat === "sql") {
        output = generateSQL(parsed.data, pendingData.tableName || "converted_data");
      } else {
        output = generateCSV(parsed.data);
      }

      // Clean up the pending conversion
      await storage.deletePendingConversion(pendingSessionId);

      const result: ConversionResult = {
        output,
        lineCount: pendingData.jsonInput.split('\n').length,
        nestingLevel: parsed.maxNestingLevel,
        requiresPayment: false
      };

      res.json(result);
    } catch (error) {
      console.error("Success route error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process conversion" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
