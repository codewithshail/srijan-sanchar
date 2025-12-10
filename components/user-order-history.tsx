"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LoadingButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { useRazorpay } from "@/hooks/use-razorpay";

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface PrintOrder {
  id: string;
  storyId: string;
  storyTitle: string | null;
  orderStatus: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
  bookSize: string;
  coverType: string;
  quantity: number;
  totalAmount: number;
  trackingNumber?: string | null;
  shippingAddress: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "delivered":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "shipped":
      return <Truck className="h-5 w-5 text-blue-600" />;
    case "processing":
      return <Package className="h-5 w-5 text-yellow-600" />;
    case "paid":
      return <CreditCard className="h-5 w-5 text-green-600" />;
    case "pending":
      return <Clock className="h-5 w-5 text-gray-600" />;
    case "cancelled":
      return <XCircle className="h-5 w-5 text-red-600" />;
    default:
      return <Package className="h-5 w-5" />;
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "delivered":
      return "default";
    case "shipped":
      return "default";
    case "processing":
      return "secondary";
    case "paid":
      return "secondary";
    case "pending":
      return "outline";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
};

const getStatusMessage = (status: string) => {
  switch (status) {
    case "delivered":
      return "Your book has been delivered!";
    case "shipped":
      return "Your book is on its way!";
    case "processing":
      return "Your book is being printed and prepared.";
    case "paid":
      return "Payment received. We'll start processing soon.";
    case "pending":
      return "Awaiting payment.";
    case "cancelled":
      return "This order has been cancelled.";
    default:
      return "";
  }
};

const ORDER_STEPS = [
  { status: "paid", label: "Payment Received" },
  { status: "processing", label: "Processing" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

function OrderProgress({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === "pending" || currentStatus === "cancelled") {
    return null;
  }

  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === currentStatus);

  return (
    <div className="flex items-center justify-between mt-4 mb-2">
      {ORDER_STEPS.map((step, index) => (
        <div key={step.status} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index < currentIndex ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className="text-xs mt-1 text-center max-w-[80px]">
              {step.label}
            </span>
          </div>
          {index < ORDER_STEPS.length - 1 && (
            <div
              className={`h-0.5 w-8 sm:w-16 mx-1 ${
                index < currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function UserOrderHistory() {
  const queryClient = useQueryClient();
  const { isLoaded: razorpayLoaded, openPayment } = useRazorpay();

  const { data: orders, isLoading } = useQuery<PrintOrder[]>({
    queryKey: ["printOrders"],
    queryFn: async () => {
      const res = await fetch("/api/print-orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  const retryPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/print-orders/${orderId}/retry-payment`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create payment order");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      printOrderId: string;
    }) => {
      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Payment verification failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment successful!");
      queryClient.invalidateQueries({ queryKey: ["printOrders"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleRetryPayment = async (order: PrintOrder) => {
    if (!razorpayLoaded) {
      toast.error("Payment system is loading. Please try again.");
      return;
    }

    try {
      const paymentOrder = await retryPaymentMutation.mutateAsync(order.id);

      openPayment({
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "StoryWeave",
        description: `Print Order - ${order.storyTitle || "Your Story"}`,
        order_id: paymentOrder.orderId,
        theme: { color: "#6366f1" },
        handler: async (response) => {
          await verifyPaymentMutation.mutateAsync({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            printOrderId: order.id,
          });
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled.");
          },
        },
      });
    } catch (error) {
      console.error("Retry payment error:", error);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount / 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Orders Yet</h3>
          <p className="text-muted-foreground mt-2">
            Order a printed copy of your story to have a physical keepsake.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="space-y-4">
        {orders.map((order) => (
          <AccordionItem key={order.id} value={order.id} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.orderStatus)}
                  <div className="text-left">
                    <p className="font-medium">{order.storyTitle || "Untitled Story"}</p>
                    <p className="text-sm text-muted-foreground">
                      Order #{order.id.slice(0, 8)} • {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusBadgeVariant(order.orderStatus)}>
                    {order.orderStatus}
                  </Badge>
                  <span className="font-semibold">{formatAmount(order.totalAmount)}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {/* Status Message */}
                <p className="text-sm text-muted-foreground">
                  {getStatusMessage(order.orderStatus)}
                </p>

                {/* Order Progress */}
                <OrderProgress currentStatus={order.orderStatus} />

                {/* Order Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Book Size</p>
                    <p className="font-medium">{order.bookSize}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cover Type</p>
                    <p className="font-medium capitalize">{order.coverType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="font-medium">{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-medium">{formatAmount(order.totalAmount)}</p>
                  </div>
                </div>

                {/* Tracking Number */}
                {order.trackingNumber && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Tracking Number</p>
                        <p className="font-mono font-medium">{order.trackingNumber}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://www.google.com/search?q=${order.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Track <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-medium">{order.shippingAddress.fullName}</p>
                      <p>{order.shippingAddress.addressLine1}</p>
                      {order.shippingAddress.addressLine2 && (
                        <p>{order.shippingAddress.addressLine2}</p>
                      )}
                      <p>
                        {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                        {order.shippingAddress.postalCode}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Phone: {order.shippingAddress.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {order.orderStatus === "pending" && (
                  <div className="pt-2">
                    <LoadingButton
                      onClick={() => handleRetryPayment(order)}
                      loading={retryPaymentMutation.isPending || verifyPaymentMutation.isPending}
                      disabled={!razorpayLoaded}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Complete Payment
                    </LoadingButton>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
