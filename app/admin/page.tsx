import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookCopy } from "lucide-react";
import { UsersTable } from "./users-table";
import { StoriesTable } from "./stories-table";

export default function AdminDashboardPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> User Management</TabsTrigger>
          <TabsTrigger value="stories"><BookCopy className="mr-2 h-4 w-4" /> Story Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
            <UsersTable />
        </TabsContent>
        <TabsContent value="stories">
            <StoriesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}