import { LocalPassIcon, ButtonType } from "@localpass/components";

export type SubscriptionPricingCardDetails = {
  title: string;
  tagline: string;
  price?: {
    amount: number;
    cadence: "month" | "monthly" | "year" | "annually";
    showPerUser?: boolean;
  };
  button: {
    text: string;
    type: ButtonType;
    icon?: { type: LocalPassIcon; position: "before" | "after" };
  };
  features: string[];
};
