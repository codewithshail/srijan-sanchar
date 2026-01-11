"use client";

import { UserOrderHistory } from "@/components/user-order-history";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OrdersPage() {
  return (
    <div className="container py-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Print Orders</h1>
          <p className="text-muted-foreground">
            Track and manage your print-on-demand orders
          </p>
        </div>
      </div>

      <UserOrderHistory />
    </div>
  );
}
