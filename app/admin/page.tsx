import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookCopy, Package, Briefcase, Shield } from "lucide-react";
import { UsersTable } from "./users-table";
import { StoriesTable } from "./stories-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <Tabs defaultValue="users" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <TabsList className="inline-flex min-w-max">
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">User Management</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-1.5">
              <BookCopy className="h-4 w-4" />
              <span className="hidden sm:inline">Story Overview</span>
              <span className="sm:hidden">Stories</span>
            </TabsTrigger>
            <TabsTrigger value="print-orders" className="gap-1.5">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Print Orders</span>
              <span className="sm:hidden">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="moderation" className="gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Moderation</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="users">
          <UsersTable />
        </TabsContent>
        <TabsContent value="stories">
          <StoriesTable />
        </TabsContent>
        <TabsContent value="print-orders">
          <div className="py-4">
            <Link href="/admin/print-orders">
              <Button>
                <Package className="mr-2 h-4 w-4" />
                Open Print Orders Management
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-2">
              Manage print-on-demand orders, update statuses, and add tracking information.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="jobs">
          <div className="py-4">
            <Link href="/admin/jobs">
              <Button>
                <Briefcase className="mr-2 h-4 w-4" />
                Open Jobs Dashboard
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-2">
              Monitor background jobs for story, image, and audio generation.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="moderation">
          <div className="py-4">
            <Link href="/admin/moderation">
              <Button>
                <Shield className="mr-2 h-4 w-4" />
                Open Moderation Dashboard
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-2">
              Review flagged content, manage spam detection, and moderate user-generated content.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}