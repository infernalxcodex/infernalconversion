import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, X, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PRICING_TIERS } from "@shared/schema";
import type { CheckoutSessionRequest } from "@shared/schema";

interface PaymentGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineCount: number;
}

export function PaymentGateModal({ open, onOpenChange, lineCount }: PaymentGateModalProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async (data: CheckoutSessionRequest) => {
      const response = await apiRequest<{ url: string }>("POST", "/api/create-checkout-session", data);
      return response;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Payment initialization failed",
        description: error.message,
      });
    },
  });

  const handleSelectPlan = (tierId: string) => {
    const tier = PRICING_TIERS.find(t => t.id === tierId);
    if (!tier) return;

    // Send tier ID to backend - backend will map to actual Stripe price ID
    checkoutMutation.mutate({
      priceId: tier.id,
      mode: tier.interval === "one-time" ? "payment" : "subscription",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center">
            Upgrade to Convert Large Files
          </DialogTitle>
          <p className="text-center text-muted-foreground mt-2">
            You have {lineCount} lines of JSON. Free tier supports up to 50 lines.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {PRICING_TIERS.map((tier) => {
            const isPopular = tier.id === "monthly";
            const isSelected = selectedTier === tier.id;

            return (
              <Card
                key={tier.id}
                className={`relative p-6 hover-elevate cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedTier(tier.id)}
                data-testid={`card-pricing-${tier.id}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      ${tier.price}
                    </span>
                    {tier.interval !== "one-time" && (
                      <span className="text-muted-foreground">/{tier.interval === "month" ? "mo" : "yr"}</span>
                    )}
                  </div>
                  {tier.interval === "year" && (
                    <p className="text-sm text-primary mt-1">Save $39.89/year</p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(tier.id);
                  }}
                  disabled={checkoutMutation.isPending}
                  variant={isPopular ? "default" : "outline"}
                  className="w-full"
                  data-testid={`button-select-${tier.id}`}
                >
                  {checkoutMutation.isPending ? (
                    "Processing..."
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Select Plan
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            <span>Powered by Stripe • Secure payment processing with automatic tax calculation</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
