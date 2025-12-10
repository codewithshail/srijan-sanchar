"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, LoadingButton } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, CreditCard, BookOpen, Minus, Plus, CheckCircle } from "lucide-react";
import { useRazorpay } from "@/hooks/use-razorpay";

// Pricing configuration (must match server-side)
const PRICING = {
  basePrice: 999, // ₹999 base price per copy
  bookSizeMultiplier: {
    A5: 1.0,
    A4: 1.3,
    custom: 1.5,
  } as Record<string, number>,
  coverTypeMultiplier: {
    paperback: 1.0,
    hardcover: 1.5,
  } as Record<string, number>,
};

const BOOK_SIZES = [
  { value: "A5", label: "A5 (5.8\" × 8.3\")", description: "Compact, portable size" },
  { value: "A4", label: "A4 (8.3\" × 11.7\")", description: "Standard, larger format" },
  { value: "custom", label: "Custom Size", description: "Premium custom dimensions" },
];

const COVER_TYPES = [
  { value: "paperback", label: "Paperback", description: "Flexible, lightweight cover" },
  { value: "hardcover", label: "Hardcover", description: "Durable, premium finish" },
];

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface PrintOrderDialogProps {
  storyId: string;
  storyTitle: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function PrintOrderDialog({
  storyId,
  storyTitle,
  trigger,
  onSuccess,
}: PrintOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"options" | "shipping" | "review" | "success">("options");
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isLoaded: razorpayLoaded, openPayment } = useRazorpay();

  // Form state
  const [bookSize, setBookSize] = useState<"A5" | "A4" | "custom">("A5");
  const [coverType, setCoverType] = useState<"paperback" | "hardcover">("paperback");
  const [quantity, setQuantity] = useState(1);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate price
  const calculatePrice = () => {
    const sizeMultiplier = PRICING.bookSizeMultiplier[bookSize] || 1;
    const coverMultiplier = PRICING.coverTypeMultiplier[coverType] || 1;
    const pricePerCopy = Math.round(PRICING.basePrice * sizeMultiplier * coverMultiplier);
    return {
      pricePerCopy,
      totalPrice: pricePerCopy * quantity,
    };
  };

  const { pricePerCopy, totalPrice } = calculatePrice();

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/print-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          bookSize,
          coverType,
          quantity,
          shippingAddress,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      setCurrentOrderId(data.id);
      // Create Razorpay payment order
      initiatePayment(data.id);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Create Razorpay order mutation
  const createPaymentOrderMutation = useMutation({
    mutationFn: async (printOrderId: string) => {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printOrderId }),
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

  // Verify payment mutation
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
      toast.success("Payment successful! Your order has been confirmed.");
      queryClient.invalidateQueries({ queryKey: ["printOrders"] });
      setStep("success");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Initiate payment flow
  const initiatePayment = async (printOrderId: string) => {
    if (!razorpayLoaded) {
      toast.error("Payment system is loading. Please try again.");
      return;
    }

    try {
      const paymentOrder = await createPaymentOrderMutation.mutateAsync(printOrderId);

      openPayment({
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "StoryWeave",
        description: `Print Order - ${storyTitle || "Your Story"}`,
        order_id: paymentOrder.orderId,
        prefill: {
          name: shippingAddress.fullName,
          contact: shippingAddress.phone,
        },
        notes: {
          printOrderId: printOrderId,
        },
        theme: {
          color: "#6366f1",
        },
        handler: async (response) => {
          // Verify payment on server
          await verifyPaymentMutation.mutateAsync({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            printOrderId: printOrderId,
          });
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled. You can retry from your dashboard.");
          },
        },
      });
    } catch (error) {
      console.error("Payment initiation error:", error);
    }
  };

  const resetForm = () => {
    setStep("options");
    setBookSize("A5");
    setCoverType("paperback");
    setQuantity(1);
    setShippingAddress({
      fullName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      phone: "",
    });
    setErrors({});
    setCurrentOrderId(null);
  };

  const validateShipping = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!shippingAddress.fullName || shippingAddress.fullName.length < 2) {
      newErrors.fullName = "Full name is required";
    }
    if (!shippingAddress.phone || shippingAddress.phone.length < 10) {
      newErrors.phone = "Valid phone number is required";
    }
    if (!shippingAddress.addressLine1 || shippingAddress.addressLine1.length < 5) {
      newErrors.addressLine1 = "Address is required";
    }
    if (!shippingAddress.city || shippingAddress.city.length < 2) {
      newErrors.city = "City is required";
    }
    if (!shippingAddress.state || shippingAddress.state.length < 2) {
      newErrors.state = "State is required";
    }
    if (!shippingAddress.postalCode || shippingAddress.postalCode.length < 5) {
      newErrors.postalCode = "Valid postal code is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === "options") {
      setStep("shipping");
    } else if (step === "shipping") {
      if (validateShipping()) {
        setStep("review");
      }
    }
  };

  const handleBack = () => {
    if (step === "shipping") setStep("options");
    else if (step === "review") setStep("shipping");
  };

  const handleSubmit = () => {
    createOrderMutation.mutate();
  };

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const updateShippingField = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Package className="mr-2 h-4 w-4" />
            Order Print Copy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Order Print Copy
          </DialogTitle>
          <DialogDescription>
            Get a professionally printed copy of &quot;{storyTitle || "your story"}&quot;
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        {step !== "success" && (
          <div className="flex items-center justify-center gap-2 py-4">
            {["options", "shipping", "review"].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : ["options", "shipping", "review"].indexOf(step) > i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`w-12 h-0.5 ${
                      ["options", "shipping", "review"].indexOf(step) > i
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Book Options */}
          {step === "options" && (
            <div className="space-y-6">
              {/* Book Size Selection */}
              <div className="space-y-2">
                <Label>Book Size</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BOOK_SIZES.map((size) => (
                    <Card
                      key={size.value}
                      className={`cursor-pointer transition-all ${
                        bookSize === size.value
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setBookSize(size.value as "A5" | "A4" | "custom")}
                    >
                      <CardContent className="p-4 text-center">
                        <p className="font-medium">{size.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {size.description}
                        </p>
                        {PRICING.bookSizeMultiplier[size.value] > 1 && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            +{Math.round((PRICING.bookSizeMultiplier[size.value] - 1) * 100)}%
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Cover Type Selection */}
              <div className="space-y-2">
                <Label>Cover Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {COVER_TYPES.map((cover) => (
                    <Card
                      key={cover.value}
                      className={`cursor-pointer transition-all ${
                        coverType === cover.value
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setCoverType(cover.value as "paperback" | "hardcover")}
                    >
                      <CardContent className="p-4 text-center">
                        <p className="font-medium">{cover.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cover.description}
                        </p>
                        {PRICING.coverTypeMultiplier[cover.value] > 1 && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            +{Math.round((PRICING.coverTypeMultiplier[cover.value] - 1) * 100)}%
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-2xl font-bold w-12 text-center">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(100, quantity + 1))}
                    disabled={quantity >= 100}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Maximum 100 copies per order</p>
              </div>

              {/* Price Summary */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Price per copy:</span>
                    <span className="font-medium">₹{pricePerCopy.toLocaleString()}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total ({quantity} {quantity === 1 ? "copy" : "copies"}):</span>
                    <span className="text-xl font-bold text-primary">
                      ₹{totalPrice.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Shipping Address */}
          {step === "shipping" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <Truck className="h-5 w-5" />
                <span>Shipping Information</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={shippingAddress.fullName}
                  onChange={(e) => updateShippingField("fullName", e.target.value)}
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+91 XXXXX XXXXX"
                  value={shippingAddress.phone}
                  onChange={(e) => updateShippingField("phone", e.target.value)}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  placeholder="House/Flat No., Building Name"
                  value={shippingAddress.addressLine1}
                  onChange={(e) => updateShippingField("addressLine1", e.target.value)}
                />
                {errors.addressLine1 && <p className="text-sm text-destructive">{errors.addressLine1}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                <Input
                  id="addressLine2"
                  placeholder="Street, Landmark"
                  value={shippingAddress.addressLine2}
                  onChange={(e) => updateShippingField("addressLine2", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={shippingAddress.city}
                    onChange={(e) => updateShippingField("city", e.target.value)}
                  />
                  {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={shippingAddress.state}
                    onChange={(e) => updateShippingField("state", e.target.value)}
                  />
                  {errors.state && <p className="text-sm text-destructive">{errors.state}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    placeholder="XXXXXX"
                    value={shippingAddress.postalCode}
                    onChange={(e) => updateShippingField("postalCode", e.target.value)}
                  />
                  {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={shippingAddress.country}
                    disabled
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review Order */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <CreditCard className="h-5 w-5" />
                <span>Review Your Order</span>
              </div>

              {/* Order Summary */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Book Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Story:</span>
                      <span className="font-medium truncate">{storyTitle || "Untitled"}</span>
                      <span className="text-muted-foreground">Size:</span>
                      <span>{BOOK_SIZES.find(s => s.value === bookSize)?.label}</span>
                      <span className="text-muted-foreground">Cover:</span>
                      <span className="capitalize">{coverType}</span>
                      <span className="text-muted-foreground">Quantity:</span>
                      <span>{quantity} {quantity === 1 ? "copy" : "copies"}</span>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-2">Shipping Address</h4>
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{shippingAddress.fullName}</p>
                      <p>{shippingAddress.addressLine1}</p>
                      {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                      <p>
                        {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postalCode}
                      </p>
                      <p>{shippingAddress.country}</p>
                      <p className="mt-1">Phone: {shippingAddress.phone}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-2">Payment Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {quantity} × ₹{pricePerCopy.toLocaleString()}
                        </span>
                        <span>₹{totalPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="text-green-600">Free</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">₹{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                By placing this order, you agree to our terms of service and privacy policy.
                Payment will be processed securely via Razorpay.
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <div className="space-y-6 text-center py-8">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Order Confirmed!</h3>
                <p className="text-muted-foreground">
                  Thank you for your order. We&apos;ve sent a confirmation email with your order details.
                </p>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-4 text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-mono text-xs">{currentOrderId?.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span className="font-semibold text-green-600">₹{totalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="default" className="bg-green-600">Paid</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                Your book will be printed and shipped within 5-7 business days.
                You can track your order from the dashboard.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === "success" ? (
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Close
            </Button>
          ) : (
            <>
              {step !== "options" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={createOrderMutation.isPending || createPaymentOrderMutation.isPending}
                >
                  Back
                </Button>
              )}
              {step !== "review" ? (
                <Button type="button" onClick={handleNext}>
                  Continue
                </Button>
              ) : (
                <LoadingButton
                  type="button"
                  onClick={handleSubmit}
                  loading={createOrderMutation.isPending || createPaymentOrderMutation.isPending}
                  disabled={!razorpayLoaded}
                  icon={<CreditCard className="h-4 w-4" />}
                >
                  {!razorpayLoaded ? "Loading..." : `Pay ₹${totalPrice.toLocaleString()}`}
                </LoadingButton>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
