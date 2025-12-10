import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { printOrders, stories, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

// Pricing configuration (in paise - 100 paise = ₹1)
const PRICING = {
  basePrice: 99900, // ₹999 base price per copy
  bookSizeMultiplier: {
    A5: 1.0,
    A4: 1.3,
    custom: 1.5,
  },
  coverTypeMultiplier: {
    paperback: 1.0,
    hardcover: 1.5,
  },
};

// Validation schema for shipping address
const shippingAddressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  addressLine1: z.string().min(5, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(5, "Valid postal code is required"),
  country: z.string().default("India"),
  phone: z.string().min(10, "Valid phone number is required"),
});

// Validation schema for print order creation
const createPrintOrderSchema = z.object({
  storyId: z.string().uuid("Invalid story ID"),
  bookSize: z.enum(["A5", "A4", "custom"]),
  coverType: z.enum(["paperback", "hardcover"]),
  quantity: z.number().int().min(1).max(100),
  shippingAddress: shippingAddressSchema,
});

// Calculate total price based on options
function calculateTotalPrice(
  bookSize: "A5" | "A4" | "custom",
  coverType: "paperback" | "hardcover",
  quantity: number
): number {
  const basePrice = PRICING.basePrice;
  const sizeMultiplier = PRICING.bookSizeMultiplier[bookSize];
  const coverMultiplier = PRICING.coverTypeMultiplier[coverType];
  
  const pricePerCopy = Math.round(basePrice * sizeMultiplier * coverMultiplier);
  return pricePerCopy * quantity;
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's print orders with story details
    const orders = await db
      .select({
        id: printOrders.id,
        storyId: printOrders.storyId,
        orderStatus: printOrders.orderStatus,
        bookSize: printOrders.bookSize,
        coverType: printOrders.coverType,
        quantity: printOrders.quantity,
        totalAmount: printOrders.totalAmount,
        razorpayOrderId: printOrders.razorpayOrderId,
        razorpayPaymentId: printOrders.razorpayPaymentId,
        shippingAddress: printOrders.shippingAddress,
        trackingNumber: printOrders.trackingNumber,
        createdAt: printOrders.createdAt,
        updatedAt: printOrders.updatedAt,
        storyTitle: stories.title,
      })
      .from(printOrders)
      .innerJoin(stories, eq(printOrders.storyId, stories.id))
      .where(eq(printOrders.userId, user.id))
      .orderBy(desc(printOrders.createdAt));

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching print orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch print orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = createPrintOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { storyId, bookSize, coverType, quantity, shippingAddress } = validationResult.data;

    // Verify the story exists and belongs to the user (or is published)
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // User can only order print copies of their own stories or published stories
    if (story.ownerId !== user.id && story.status !== "published") {
      return NextResponse.json(
        { error: "You can only order print copies of your own stories or published stories" },
        { status: 403 }
      );
    }

    // Calculate total amount
    const totalAmount = calculateTotalPrice(bookSize, coverType, quantity);

    // Create the print order
    const [newOrder] = await db
      .insert(printOrders)
      .values({
        storyId,
        userId: user.id,
        bookSize,
        coverType,
        quantity,
        totalAmount,
        shippingAddress,
        orderStatus: "pending",
      })
      .returning();

    return NextResponse.json({
      id: newOrder.id,
      storyId: newOrder.storyId,
      bookSize: newOrder.bookSize,
      coverType: newOrder.coverType,
      quantity: newOrder.quantity,
      totalAmount: newOrder.totalAmount,
      orderStatus: newOrder.orderStatus,
      shippingAddress: newOrder.shippingAddress,
      createdAt: newOrder.createdAt,
      message: "Print order created successfully. Proceed to payment.",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating print order:", error);
    return NextResponse.json(
      { error: "Failed to create print order" },
      { status: 500 }
    );
  }
}

// GET pricing information
export async function OPTIONS() {
  return NextResponse.json({
    pricing: {
      basePrice: PRICING.basePrice / 100, // Convert to rupees for display
      currency: "INR",
      bookSizes: [
        { value: "A5", label: "A5 (5.8\" x 8.3\")", multiplier: PRICING.bookSizeMultiplier.A5 },
        { value: "A4", label: "A4 (8.3\" x 11.7\")", multiplier: PRICING.bookSizeMultiplier.A4 },
        { value: "custom", label: "Custom Size", multiplier: PRICING.bookSizeMultiplier.custom },
      ],
      coverTypes: [
        { value: "paperback", label: "Paperback", multiplier: PRICING.coverTypeMultiplier.paperback },
        { value: "hardcover", label: "Hardcover", multiplier: PRICING.coverTypeMultiplier.hardcover },
      ],
    },
  });
}
